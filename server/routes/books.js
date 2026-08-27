/* ============================================
   Books Routes — CRUD + search + upload + ratings + comments
   ============================================ */

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const Store = require('../db');
const { generateCoverFromPDF } = require('../cover-generator');
const coverService = require('../cover-service');

// Helper: proxy a remote URL and pipe to response
function proxyUrl(url, res, disposition) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (upstream) => {
      // Follow redirects (up to 3)
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        const redirectUrl = upstream.headers.location;
        const proto2 = redirectUrl.startsWith('https') ? https : http;
        proto2.get(redirectUrl, (redirected) => {
          if (redirected.statusCode >= 300 && redirected.statusCode < 400 && redirected.headers.location) {
            const proto3 = redirected.headers.location.startsWith('https') ? https : http;
            proto3.get(redirected.headers.location, (final) => {
              res.writeHead(final.statusCode, {
                'Content-Type': final.headers['content-type'] || 'application/octet-stream',
                'Content-Disposition': disposition,
                'Cache-Control': 'no-cache',
              });
              final.pipe(res);
              final.on('end', resolve);
              final.on('error', () => { res.status(500).end(); resolve(); });
            }).on('error', () => { res.status(500).end(); resolve(); });
            return;
          }
          res.writeHead(redirected.statusCode, {
            'Content-Type': redirected.headers['content-type'] || 'application/octet-stream',
            'Content-Disposition': disposition,
            'Cache-Control': 'no-cache',
          });
          redirected.pipe(res);
          redirected.on('end', resolve);
          redirected.on('error', () => { res.status(500).end(); resolve(); });
        }).on('error', () => { res.status(500).end(); resolve(); });
        return;
      }
      res.writeHead(upstream.statusCode, {
        'Content-Type': upstream.headers['content-type'] || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Cache-Control': 'no-cache',
      });
      upstream.pipe(res);
      upstream.on('end', resolve);
      upstream.on('error', () => { res.status(500).end(); resolve(); });
    }).on('error', (err) => {
      console.error('❌ proxy error:', err.message);
      res.status(500).end();
      resolve();
    });
  });
}

// Sanitize a book title for use as a filename
function sanitizeFilename(name) {
  return (name || 'documento')
    .replace(/[\\/:*?"<>|]/g, '_')   // remove illegal chars
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim()
    .slice(0, 100);                     // limit length
}

const router = Router();

// ---- Multer config ----
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTS = ['.pdf', '.epub', '.mobi', '.doc', '.docx'];
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

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

// Multer for cover image uploads
const coverUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB for cover images
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagen no soportado. Formatos válidos: ' + ALLOWED_IMAGE_EXTS.join(', ')));
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

// GET /api/books/auto-cover-search — search covers from Open Library (must be before /:id)
router.get('/auto-cover-search', async (req, res) => {
  try {
    const { title, author } = req.query;
    if (!title) {
      return res.status(400).json({ error: 'Se requiere al menos un título.' });
    }
    const covers = await coverService.searchCovers(title, author || '', 6);
    res.json({ covers });
  } catch (err) {
    console.error('❌ auto-cover-search error:', err.message);
    res.status(500).json({ error: 'Error al buscar portadas.' });
  }
});

// POST /api/books/auto-cover — generate covers for books without cover (admin) (must be before /:id)
router.post('/auto-cover', requireAuth, async (req, res) => {
  try {
    const { book_ids } = req.body; // optional: specific book IDs to process
    const admin = await Store.isAdmin(req.session.user.id);
    if (!admin && (!book_ids || book_ids.length === 0)) {
      return res.status(403).json({ error: 'Solo los administradores pueden generar portadas masivamente.' });
    }

    let booksToProcess;
    if (book_ids && book_ids.length > 0) {
      // Process specific books
      booksToProcess = [];
      for (const id of book_ids) {
        const book = await Store.bookById(id);
        if (book) booksToProcess.push(book);
      }
    } else {
      // Process all books without cover
      const allBooks = await Store.allBooks();
      booksToProcess = allBooks.filter(b => !b.cover_url || b.cover_url === '');
    }

    let generated = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];

    for (const book of booksToProcess) {
      try {
        // Use extractCoverFromBook: PDF first page → Open Library → Placeholder
        let coverUrl;
        try {
          coverUrl = await coverService.extractCoverFromBook(book);
        } catch (coverErr) {
          console.error('❌ extractCoverFromBook error for', book.title, ':', coverErr.message);
        }
        if (coverUrl) {
          await Store.updateBookCover(book.id, coverUrl);
          generated++;
          results.push({ book_id: book.id, title: book.title, cover_url: coverUrl, status: 'generated' });
        } else {
          skipped++;
          results.push({ book_id: book.id, title: book.title, status: 'skipped' });
        }
      } catch (err) {
        errors++;
        results.push({ book_id: book.id, title: book.title, status: 'error', error: err.message });
      }
    }

    res.json({ generated, skipped, errors, total: booksToProcess.length, results });
  } catch (err) {
    console.error('❌ auto-cover error:', err.message);
    res.status(500).json({ error: 'Error al generar portadas.' });
  }
});

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

// GET /api/books/:id/stream — stream file for in-page viewing (must be before /:id)
router.get('/:id/stream', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    // Map file extensions to MIME types
    const MIME_TYPES = {
      '.pdf': 'application/pdf',
      '.epub': 'application/epub+zip',
      '.mobi': 'application/x-mobipocket-ebook',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
    };

    // Get file extension from URL
    const cleanUrl = (book.file_url || '').split('?')[0];
    const ext = path.extname(cleanUrl).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // If file_url is an external URL (Supabase Storage), proxy it with inline disposition
    if (book.file_url && book.file_url.startsWith('http')) {
      return proxyUrl(book.file_url, res, 'inline');
    }

    // If the file exists on disk, serve it with correct Content-Type
    if (book.file_url) {
      const filePath = path.join(__dirname, '..', book.file_url);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        return res.sendFile(filePath);
      }
    }

    res.status(404).json({ error: 'Archivo no disponible.' });
  } catch (err) {
    console.error('❌ stream error:', err.message);
    res.status(500).json({ error: 'Error al cargar documento.' });
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

// POST /api/books/:id/auto-cover — auto-generate cover for a specific book
router.post('/:id/auto-cover', requireAuth, async (req, res) => {
  try {
    console.log(`🖼️ Auto-cover request for book ${req.params.id} by user ${req.session.user.id}`);

    const book = await Store.bookById(req.params.id);
    if (!book) {
      console.log('❌ Book not found:', req.params.id);
      return res.status(404).json({ error: 'Documento no encontrado.' });
    }

    console.log(`📖 Book: "${book.title}" by ${book.author}, owner: ${book.user_id}`);

    // Only owner or admin can generate cover
    const userIsAdmin = await Store.isAdmin(req.session.user.id);
    console.log(`👤 User is admin: ${userIsAdmin}, is owner: ${book.user_id === req.session.user.id}`);

    if (book.user_id !== req.session.user.id && !userIsAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este documento.' });
    }

    // Use extractCoverFromBook: PDF first page → Open Library → Placeholder
    let coverUrl = null;
    try {
      coverUrl = await coverService.extractCoverFromBook(book);
    } catch (coverErr) {
      console.error('❌ coverService.extractCoverFromBook threw:', coverErr.message);
    }

    // Ultimate fallback: data URI SVG (always works)
    if (!coverUrl) {
      const svg = coverService.generatePlaceholderSVG(book.title, book.author, book.category, book.id);
      const encoded = Buffer.from(svg, 'utf8').toString('base64');
      coverUrl = `data:image/svg+xml;base64,${encoded}`;
      console.log('✅ Using inline data URI SVG as final fallback');
    }

    console.log('📎 Generated cover URL:', coverUrl ? coverUrl.substring(0, 80) + '...' : 'null');

    // Update book with new cover (using dedicated cover update method)
    const result = await Store.updateBookCover(book.id, coverUrl);
    console.log('✅ Cover updated successfully for book:', book.title);

    res.json({ cover_url: coverUrl, book: result });
  } catch (err) {
    console.error('❌ auto-cover single error:', err.message);
    console.error('❌ Full error stack:', err.stack);
    res.status(500).json({ error: 'Error al generar portada: ' + err.message });
  }
});

// GET /api/books/:id
router.get('/:id', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    // Enrich with rating stats, comment count, and favorite count
    const ratingStats = await Store.getRatingStats(req.params.id);
    const commentData = await Store.getComments(req.params.id);
    const favCount = await Store.favoriteCount(req.params.id);
    let userRating = 0;
    if (req.session && req.session.user) {
      userRating = await Store.getUserRating(req.session.user.id, req.params.id);
    }

    res.json({
      book: {
        ...book,
        rating: ratingStats,
        comment_count: commentData.total,
        favorite_count: favCount || 0,
        user_rating: userRating,
      }
    });
  } catch (err) {
    console.error('❌ book detail error:', err.message);
    res.status(500).json({ error: 'Error al obtener documento.' });
  }
});

// PUT /api/books/:id (update book — owner only)
router.put('/:id', requireAuth, (req, res, next) => {
  // Try multer for multipart (local dev), skip for JSON (Vercel)
  if (req.is('multipart/form-data')) {
    coverUpload.single('cover_image')(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  } else {
    next();
  }
}, async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const { title, author, category, description, tags, cover_url } = req.body;

    // Handle cover image update
    let bookCoverUrl = cover_url;
    const coverFile = req.file;
    if (coverFile) {
      bookCoverUrl = '/uploads/' + coverFile.filename;
    }

    const result = await Store.updateBook(req.params.id, req.session.user.id, {
      title, author, category, description, tags,
      cover_url: bookCoverUrl,
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
router.post('/', requireAuth, (req, res, next) => {
  // Try multer for multipart (local dev), skip for JSON (Vercel)
  if (req.is('multipart/form-data')) {
    // Use multer fields to handle both file and cover_image
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'cover_image', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  } else {
    next();
  }
}, async (req, res) => {
  try {
    const { title, author, category, description, tags, file_url, cover_url } = req.body;

    if (!title || !author || !category || !description) {
      return res.status(400).json({ error: 'Título, autor, categoría y descripción son obligatorios.' });
    }

    // Support both multer file upload and JSON file_url (for Vercel/Supabase Storage)
    const file = req.files && req.files.file ? req.files.file[0] : req.file;
    let bookFileUrl = file_url || '';
    if (file) {
      bookFileUrl = '/uploads/' + file.filename;
    }

    // Handle cover image
    const coverFile = req.files && req.files.cover_image ? req.files.cover_image[0] : null;
    let bookCoverUrl = cover_url || '';
    if (coverFile) {
      bookCoverUrl = '/uploads/' + coverFile.filename;
    }

    // If no cover provided, try auto-generation
    // Priority: PDF first page → Open Library → Placeholder
    if (!bookCoverUrl) {
      // 1. Extract first page from local PDF (best quality, actual document cover)
      if (bookFileUrl && !bookFileUrl.startsWith('http')) {
        try {
          const filePath = path.join(__dirname, '..', bookFileUrl);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.pdf') {
              console.log('📄 Extracting cover from PDF first page for:', title);
              const coverPath = await generateCoverFromPDF(filePath);
              if (coverPath) {
                bookCoverUrl = coverPath;
                console.log('🖼️ Cover extracted from PDF first page for:', title);
              }
            }
          }
        } catch (coverErr) {
          console.error('⚠️ Could not extract cover from PDF:', coverErr.message);
        }
      }

      // 2. Try Open Library API (fast, no system deps)
      if (!bookCoverUrl) {
        try {
          const olCover = await coverService.searchOpenLibraryCover(title, author);
          if (olCover) {
            bookCoverUrl = olCover;
            console.log('📚 Cover from Open Library for:', title);
          }
        } catch (olErr) {
          console.error('⚠️ Open Library cover search failed:', olErr.message);
        }
      }

      // 3. Final fallback: generate a placeholder SVG
      if (!bookCoverUrl) {
        const placeholder = coverService.savePlaceholderCover(title, author, category, 'pending');
        bookCoverUrl = placeholder;
        console.log('🎨 Placeholder cover for:', title);
      }
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
      file_url: bookFileUrl,
      cover_url: bookCoverUrl,
      user_id: req.session.user.id,
      tags: tagList,
    });

    res.status(201).json({ book });
  } catch (err) {
    console.error('❌ book create error:', err.message);
    console.error('❌ Full error:', JSON.stringify(err, null, 2));
    res.status(500).json({ error: 'Error al crear documento: ' + err.message });
  }
});

// GET & POST /api/books/:id/download
router.all('/:id/download', async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const downloads = await Store.incrementDownload(req.params.id);

    // Track reading history if logged in
    if (req.session && req.session.user) {
      await Store.addReadingHistory(req.session.user.id, req.params.id);
    }

    // Build filename from book title + extension
    const ext = book.file_url ? path.extname(book.file_url.split('?')[0]) || '.pdf' : '.pdf';
    const filename = sanitizeFilename(book.title) + ext;
    const disposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

    // If file_url is an external URL (Supabase Storage), proxy the file
    if (book.file_url && book.file_url.startsWith('http')) {
      return proxyUrl(book.file_url, res, disposition);
    }

    // If the file exists on disk, serve it with the book title as filename
    if (book.file_url) {
      const filePath = path.join(__dirname, '..', book.file_url);
      if (fs.existsSync(filePath)) {
        return res.download(filePath, filename);
      }
    }

    // No file available — return JSON so client can handle it
    res.json({ ok: true, downloads, file_url: book.file_url || null });
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

// POST /api/books/:id/rate — set or update rating (0.5-5 in 0.5 steps)
router.post('/:id/rate', requireAuth, async (req, res) => {
  try {
    const book = await Store.bookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Documento no encontrado.' });

    const { score } = req.body;
    if (score === undefined || score === null) {
      return res.status(400).json({ error: 'Debes proporcionar una puntuación (0.5-5).' });
    }

    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0.5 || numScore > 5) {
      return res.status(400).json({ error: 'La puntuación debe ser un número entre 0.5 y 5.' });
    }

    const stats = await Store.setRating(req.session.user.id, req.params.id, numScore);
    res.json({ ok: true, rating: stats, userRating: stats.average });
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
