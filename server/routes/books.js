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
router.get('/most-downloaded', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 6, 20);
  const books = Store.mostDownloaded(limit);
  res.json({ books });
});

// GET /api/books/recent  (must be before /:id)
router.get('/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 6, 20);
  const books = Store.recentBooks(limit);
  res.json({ books });
});

// GET /api/books (with pagination support)
router.get('/', (req, res) => {
  const { q, category, page, per_page } = req.query;
  if (page) {
    const result = Store.searchBooksPaginated({
      query: q || '',
      category: category || '',
      page: parseInt(page) || 1,
      perPage: parseInt(per_page) || 12,
    });
    return res.json(result);
  }
  const books = Store.searchBooks({ query: q || '', category: category || '' });
  res.json({ books });
});

// GET /api/books/:id
router.get('/:id', (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  // Enrich with rating stats
  const ratingStats = Store.getRatingStats(req.params.id);
  const commentCount = Store.getComments(req.params.id).total;
  let userRating = 0;
  if (req.session && req.session.user) {
    userRating = Store.getUserRating(req.session.user.id, req.params.id);
  }

  res.json({
    book: {
      ...book,
      rating: ratingStats,
      comment_count: commentCount,
      user_rating: userRating,
    }
  });
});

// PUT /api/books/:id (update book — owner only)
router.put('/:id', requireAuth, (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const { title, author, category, description, tags } = req.body;
  const result = Store.updateBook(req.params.id, req.session.user.id, {
    title, author, category, description, tags,
  });

  if (result && result.error === 'forbidden') {
    return res.status(403).json({ error: 'No tienes permiso para editar este documento.' });
  }

  res.json({ book: result });
});

// DELETE /api/books/:id (delete book — owner only)
router.delete('/:id', requireAuth, (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const result = Store.deleteBook(req.params.id, req.session.user.id);

  if (result && result.error === 'forbidden') {
    return res.status(403).json({ error: 'No tienes permiso para eliminar este documento.' });
  }

  // Clean up uploaded file if exists
  if (result.file_path) {
    const filePath = path.join(__dirname, '..', result.file_path);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }

  res.json({ ok: true });
});

// POST /api/books
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  const { title, author, category, description, tags } = req.body;

  if (!title || !author || !category || !description) {
    return res.status(400).json({ error: 'Título, autor, categoría y descripción son obligatorios.' });
  }

  const file = req.file;
  let fileType = 'PDF';
  let fileName = '';
  let filePath = '';

  if (file) {
    fileType = path.extname(file.originalname).replace('.', '').toUpperCase();
    fileName = file.originalname;
    filePath = '/uploads/' + file.filename;
  }

  // Parse tags
  let tagList = [];
  if (tags) {
    try { tagList = JSON.parse(tags); } catch { tagList = String(tags).split(',').map(t => t.trim()).filter(Boolean); }
  }

  const book = Store.createBook({
    title: title.trim(),
    author: author.trim(),
    category,
    description: description.trim(),
    file_type: fileType,
    file_name: fileName,
    file_path: filePath,
    uploader_id: req.session.user.id,
    tags: tagList,
  });

  res.status(201).json({ book });
});

// POST /api/books/:id/download
router.post('/:id/download', (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const downloads = Store.incrementDownload(req.params.id);

  // Track reading history if logged in
  if (req.session && req.session.user) {
    Store.addReadingHistory(req.session.user.id, req.params.id);
  }

  // If the file exists on disk, serve it; otherwise just count the download
  if (book.file_path) {
    const filePath = path.join(__dirname, '..', book.file_path);
    if (fs.existsSync(filePath)) {
      return res.download(filePath, book.file_name || path.basename(filePath));
    }
  }

  res.json({ ok: true, downloads });
});

// POST /api/books/:id/view — register explicit view
router.post('/:id/view', (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  Store.addView(
    req.session && req.session.user ? req.session.user.id : null,
    req.params.id
  );

  res.json({ ok: true });
});

// POST /api/books/:id/favorite
router.post('/:id/favorite', requireAuth, (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const added = Store.toggleFavorite(req.session.user.id, req.params.id);
  const count = Store.favoriteCount(req.params.id);
  res.json({ ok: true, isFavorite: added, count });
});

// ---- Ratings ----

// POST /api/books/:id/rate — set or update rating (1-5)
router.post('/:id/rate', requireAuth, (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const { score } = req.body;
  if (score === undefined || score === null) {
    return res.status(400).json({ error: 'Debes proporcionar una puntuación (1-5).' });
  }

  const numScore = Number(score);
  if (isNaN(numScore) || numScore < 1 || numScore > 5) {
    return res.status(400).json({ error: 'La puntuación debe ser un número entre 1 y 5.' });
  }

  const stats = Store.setRating(req.session.user.id, req.params.id, numScore);
  res.json({ ok: true, rating: stats, userRating: numScore });
});

// GET /api/books/:id/rating — get rating stats for a book
router.get('/:id/rating', (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const stats = Store.getRatingStats(req.params.id);
  let userRating = 0;
  if (req.session && req.session.user) {
    userRating = Store.getUserRating(req.session.user.id, req.params.id);
  }

  res.json({ rating: stats, userRating });
});

// ---- Comments ----

// GET /api/books/:id/comments — list comments (paginated)
router.get('/:id/comments', (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const page = parseInt(req.query.page) || 1;
  const perPage = Math.min(parseInt(req.query.per_page) || 20, 50);
  const result = Store.getComments(req.params.id, { page, perPage });
  res.json(result);
});

// POST /api/books/:id/comments — add a comment
router.post('/:id/comments', requireAuth, (req, res) => {
  const book = Store.bookById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío.' });
  }
  if (text.trim().length > 1000) {
    return res.status(400).json({ error: 'El comentario no puede exceder 1000 caracteres.' });
  }

  const comment = Store.addComment(req.session.user.id, req.params.id, text);
  if (!comment) {
    return res.status(400).json({ error: 'No se pudo agregar el comentario.' });
  }

  res.status(201).json({ comment });
});

// DELETE /api/books/:bookId/comments/:commentId — delete own comment
router.delete('/:bookId/comments/:commentId', requireAuth, (req, res) => {
  const result = Store.deleteComment(req.params.commentId, req.session.user.id);

  if (result && result.error === 'not_found') {
    return res.status(404).json({ error: 'Comentario no encontrado.' });
  }
  if (result && result.error === 'forbidden') {
    return res.status(403).json({ error: 'No tienes permiso para eliminar este comentario.' });
  }

  res.json({ ok: true });
});

module.exports = router;
