/* ============================================
   Books Routes — CRUD + search + upload + ratings + comments
   ============================================ */

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Store = require('../db');

const router = Router();

// ---- Multer config ----
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTS = ['.pdf', '.epub', '.mobi', '.doc', '.docx'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado. Formatos válidos: ' + ALLOWED_EXTS.join(', ')));
    }
  },
});

// ---- Auth middleware ----
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  next();
}

// ---- Routes (specific routes FIRST, then parameterized) ----

// GET /api/books/most-downloaded  (must be before /:id)
router.get('/most-downloaded', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    const books = await Store.mostDownloaded(limit);
    res.json({ books });
  } catch (err) {
    console.error('❌ most-downloaded error:', err.message);
    res.status(500).json({ error: 'Error al obtener libros.' });
  }
});

// GET /api/books/recent  (must be before /:id)
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    const books = await Store.recentBooks(limit);
    res.json({ books });
  } catch (err) {
    console.error('❌ recent error:', err.message);
    res.status(500).json({ error: 'Error al obtener libros recientes.' });
  }
});

// GET /api/books (with pagination support)
router.get('/', async (req, res) => {
  try {
    const { q, category, page, per_page } = req.query;
    if (page) {
      const result = await Store.searchBooksPaginated({
        query: q || '',
        category: category || '',
        page: parseInt(page) || 1,
        perPage: parseInt(per_page) || 12,
      });
      return res.json(result);
    }
    const books = await Store.searchBooks({ query: q || '', category: category || '' });
    res.json({ books });
  } catch (err) {
    console.error('❌ search error:', err.message);
    res.status(500).json({ error: 'Error al buscar libros.' });
  }
});

// GET /api/books/:id
router.get('/:id', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    // Enrich with rating stats
    const ratingStats = await Store.getRatingStats(req.params.id);
    const commentData = await Store.getComments(req.params.id);
    let userRating = 0;
    if (req.session && req.session.user) {
      userRating = await Store.getUserRating(req.session.user.id, req.params.id);
    }

    res.json({
      book: {
        ...book,
        rating: ratingStats,
        comment_count: commentData.total,
        user_rating: userRating,
      }
    });
  } catch (err) {
    console.error('❌ book detail error:', err.message);
    res.status(500).json({ error: 'Error al obtener documento.' });
  }
});

// PUT /api/books/:id (update book — owner only)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const { title, author, category, description, tags } = req.body;
    const result = await Store.updateBook(req.params.id, req.session.user.id, {
      title, author, category, description, tags,
    });

    if (result && result.error === 'forbidden') {
      return res.status(403).json({ error: 'No tienes permiso para editar este documento.' });
    }

    res.json({ book: result });
  } catch (err) {
    console.error('❌ book update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar documento.' });
  }
});

// DELETE /api/books/:id (delete book — owner only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const result = await Store.deleteBook(req.params.id, req.session.user.id);

    if (result && result.error === 'forbidden') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este documento.' });
    }

    // Clean up uploaded file if exists
    if (result.file_url) {
      const filePath = path.join(__dirname, '..', result.file_url);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ book delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar documento.' });
  }
});

// POST /api/books
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { title, author, category, description, tags } = req.body;

    if (!title || !author || !category || !description) {
      return res.status(400).json({ error: 'Título, autor, categoría y descripción son obligatorios.' });
    }

    const file = req.file;
    let fileUrl = '';

    if (file) {
      fileUrl = '/uploads/' + file.filename;
    }

    // Parse tags
    let tagList = [];
    if (tags) {
      try { tagList = JSON.parse(tags); } catch { tagList = String(tags).split(',').map(t => t.trim()).filter(Boolean); }
    }

    const book = await Store.createBook({
      title: title.trim(),
      author: author.trim(),
      category,
      description: description.trim(),
      file_url: fileUrl,
      user_id: req.session.user.id,
      tags: tagList,
    });

    res.status(201).json({ book });
  } catch (err) {
    console.error('❌ book create error:', err.message);
    res.status(500).json({ error: 'Error al crear documento.' });
  }
});

// POST /api/books/:id/download
router.post('/:id/download', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const downloads = await Store.incrementDownload(req.params.id);

    // Track reading history if logged in
    if (req.session && req.session.user) {
      await Store.addReadingHistory(req.session.user.id, req.params.id);
    }

    // If the file exists on disk, serve it; otherwise just count the download
    if (book.file_url) {
      const filePath = path.join(__dirname, '..', book.file_url);
      if (fs.existsSync(filePath)) {
        return res.download(filePath, path.basename(book.file_url));
      }
    }

    res.json({ ok: true, downloads });
  } catch (err) {
    console.error('❌ download error:', err.message);
    res.status(500).json({ error: 'Error al descargar.' });
  }
});

// POST /api/books/:id/view — register explicit view
router.post('/:id/view', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    await Store.addView(
      req.session && req.session.user ? req.session.user.id : null,
      req.params.id
    );

    res.json({ ok: true });
  } catch (err) {
    // silently ignore view tracking errors
    res.json({ ok: true });
  }
});

// POST /api/books/:id/favorite
router.post('/:id/favorite', requireAuth, async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const added = await Store.toggleFavorite(req.session.user.id, req.params.id);
    const count = await Store.favoriteCount(req.params.id);
    res.json({ ok: true, isFavorite: added, count });
  } catch (err) {
    console.error('❌ favorite error:', err.message);
    res.status(500).json({ error: 'Error al actualizar favorito.' });
  }
});

// ---- Ratings ----

// POST /api/books/:id/rate — set or update rating (1-5)
router.post('/:id/rate', requireAuth, async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const { score } = req.body;
    if (score === undefined || score === null) {
      return res.status(400).json({ error: 'Debes proporcionar una puntuación (1-5).' });
    }

    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 1 || numScore > 5) {
      return res.status(400).json({ error: 'La puntuación debe ser un número entre 1 y 5.' });
    }

    const stats = await Store.setRating(req.session.user.id, req.params.id, numScore);
    res.json({ ok: true, rating: stats, userRating: numScore });
  } catch (err) {
    console.error('❌ rate error:', err.message);
    res.status(500).json({ error: 'Error al calificar.' });
  }
});

// GET /api/books/:id/rating — get rating stats for a book
router.get('/:id/rating', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const stats = await Store.getRatingStats(req.params.id);
    let userRating = 0;
    if (req.session && req.session.user) {
      userRating = await Store.getUserRating(req.session.user.id, req.params.id);
    }

    res.json({ rating: stats, userRating });
  } catch (err) {
    console.error('❌ rating error:', err.message);
    res.status(500).json({ error: 'Error al obtener calificación.' });
  }
});

// ---- Comments ----

// GET /api/books/:id/comments — list comments (paginated)
router.get('/:id/comments', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const page = parseInt(req.query.page) || 1;
    const perPage = Math.min(parseInt(req.query.per_page) || 20, 50);
    const result = await Store.getComments(req.params.id, { page, perPage });
    res.json(result);
  } catch (err) {
    console.error('❌ comments list error:', err.message);
    res.status(500).json({ error: 'Error al obtener comentarios.' });
  }
});

// POST /api/books/:id/comments — add a comment
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
    }
    if (text.trim().length > 1000) {
      return res.status(400).json({ error: 'El comentario no puede exceder 1000 caracteres.' });
    }

    const comment = await Store.addComment(req.session.user.id, req.params.id, text);
    if (!comment) {
      return res.status(400).json({ error: 'No se pudo agregar el comentario.' });
    }

    res.status(201).json({ comment });
  } catch (err) {
    console.error('❌ comment add error:', err.message);
    res.status(500).json({ error: 'Error al agregar comentario.' });
  }
});

// DELETE /api/books/:bookId/comments/:commentId — delete own comment
router.delete('/:bookId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const result = await Store.deleteComment(req.params.commentId, req.session.user.id);

    if (result && result.error === 'not_found') {
      return res.status(404).json({ error: 'Comentario no encontrado.' });
    }
    if (result && result.error === 'forbidden') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este comentario.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ comment delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar comentario.' });
  }
});

module.exports = router;
