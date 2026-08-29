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
const IS_VERCEL = !!process.env.VERCEL;
const UPLOAD_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, '..', 'uploads');
try { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

const ALLOWED_EXTS = ['.pdf', '.epub', '.mobi', '.doc', '.docx'];
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no soportado. Formatos válidos: ' + ALLOWED_EXTS.join(', ')));
    }
  },
});

// Multer for cover image uploads (memory storage for serverless)
const coverUpload = multer({
  storage: multer.memoryStorage(),
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
    console.error('❌ requireAuth: No session found');
    console.error('   req.session:', req.session ? 'exists' : 'null');
    console.error('   cookies:', req.headers.cookie ? req.headers.cookie.substring(0, 50) + '...' : 'none');
    console.error('   cookie header present:', !!req.headers.cookie);
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  next();
}

// ---- Supabase upload (server-side, uses service key) ----
const supabase = require('../supabase');

// Cover extraction from buffer (for upload-time extraction)
let coverGenerator;
try {
  coverGenerator = require('../cover-generator');
} catch (e) {
  console.log('⚠️ cover-generator not available for upload-time extraction');
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
      // Process all books without cover or with placeholder covers
      const allBooks = await Store.allBooks();
      booksToProcess = allBooks.filter(b => {
        if (!b.cover_url || b.cover_url === '') return true;
        // Also regenerate placeholder covers that failed
        if (b.cover_url.includes('cover-placeholder-') || b.cover_url.includes('data:image/svg+xml')) return true;
        return false;
      });
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
  if (req.is('multipart/form-data')) {
    coverUpload.single('cover_image')(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, () => {});
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

    // Handle cover image update — upload to Supabase Storage if a file was provided
    let bookCoverUrl = cover_url;
    const coverFile = req.file;
    if (coverFile) {
      try {
        const coverPath = `covers/${Date.now()}_${coverFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('documentos')
          .upload(coverPath, coverFile.buffer, {
            contentType: coverFile.mimetype || 'image/jpeg',
            upsert: false,
          });
        if (uploadErr) {
          console.error('❌ Cover upload error:', uploadErr.message);
        } else {
          const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(coverPath);
          bookCoverUrl = urlData.publicUrl;
        }
      } catch (coverErr) {
        console.error('❌ Cover upload exception:', coverErr.message);
      }
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

// Multer error handler — preserve session on upload errors
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err.code, err.message);
    let msg = 'Error al subir el archivo.';
    if (err.code === 'LIMIT_FILE_SIZE') msg = 'El archivo excede el límite de 50 MB.';
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') msg = 'Campo de archivo inesperado.';
    return res.status(400).json({ error: msg });
  }
  if (err && err.message && err.message.includes('Formato')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

// POST /api/books/upload — server-side file upload to Supabase Storage
router.post('/upload', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error on upload:', err.code, err.message);
      if (err instanceof multer.MulterError) {
        let msg = 'Error al subir el archivo.';
        if (err.code === 'LIMIT_FILE_SIZE') msg = 'El archivo excede el límite de 50 MB.';
        else if (err.code === 'LIMIT_UNEXPECTED_FILE') msg = 'Campo de archivo inesperado.';
        return res.status(400).json({ error: msg });
      }
      if (err.message && err.message.includes('Formato')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: 'Error al procesar el archivo: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = `libros/${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    console.log(`📎 Upload attempt: ${req.file.originalname} (${ext}), ${(req.file.buffer.length / 1024).toFixed(0)} KB`);

    const { data, error } = await supabase.storage
      .from('documentos')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase Storage upload error:', error.message);
      return res.status(500).json({ error: 'Error al subir el archivo: ' + error.message });
    }

    const { data: urlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(filePath);

    console.log('✅ File uploaded to Supabase:', urlData.publicUrl);

    // Respond IMMEDIATELY with file_url — cover extraction runs in background
    // This prevents Vercel timeout (10-30s) from killing the request
    res.json({ file_url: urlData.publicUrl, cover_url: '' });

    // ---- Background: try to extract cover (non-blocking) ----
    (async () => {
      try {
        // Try extraction from PDF/EPUB
        if (coverGenerator && ['.pdf', '.epub'].includes(ext)) {
          try {
            console.log(`🖼️ [bg] Extracting cover from ${ext}...`);
            let imageBuffer = null;
            if (ext === '.pdf') {
              imageBuffer = await coverGenerator.extractPDFFirstPageFromBuffer(req.file.buffer);
            } else if (ext === '.epub') {
              imageBuffer = await coverGenerator.extractEPUBCoverFromBuffer(req.file.buffer);
            }
            if (imageBuffer && imageBuffer.length > 100) {
              const coverFilename = `cover-${ext.replace('.', '')}-${Date.now()}-${Math.round(Math.random() * 1e4)}.png`;
              const coverUrl = await coverGenerator._uploadCover(imageBuffer, coverFilename);
              console.log('✅ [bg] Cover from file extraction:', coverUrl);
              return; // success, no need for fallback
            } else {
              console.log('⚠️ [bg] File extraction returned no image');
            }
          } catch (coverErr) {
            console.error('⚠️ [bg] File extraction failed:', coverErr.message);
          }
        }

        // Fallback: search Open Library for cover
        try {
          const coverSvc = require('../cover-service');
          const { title, author } = req.body;
          if (title) {
            console.log('📚 [bg] Searching Open Library for cover...');
            const olCover = await coverSvc.searchOpenLibraryCover(title.trim(), (author || '').trim());
            if (olCover) {
              console.log('✅ [bg] Cover from Open Library:', olCover);
            }
          }
        } catch (olErr) {
          console.error('⚠️ [bg] Open Library search failed:', olErr.message);
        }
      } catch (bgErr) {
        console.error('❌ [bg] Cover extraction error:', bgErr.message);
      }
    })();

    // Note: client already handles cover_url = '' gracefully
  } catch (err) {
    console.error('❌ Upload error:', err.message);
    console.error('❌ Upload error stack:', err.stack);
    // Ensure JSON is always returned, even for unexpected errors
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error al subir el archivo.' });
    }
  }
});

// POST /api/books
router.post('/', requireAuth, (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'cover_image', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, () => {});
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
      // Upload to Supabase Storage using buffer (memory storage)
      try {
        const filePath = `libros/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('documentos')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false,
          });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(filePath);
          bookFileUrl = urlData.publicUrl;
        } else {
          console.error('❌ File upload to Supabase error:', uploadErr.message);
        }
      } catch (upErr) {
        console.error('❌ File upload exception:', upErr.message);
      }
    }

    // Handle cover image — upload to Supabase Storage using buffer
    const coverFile = req.files && req.files.cover_image ? req.files.cover_image[0] : null;
    let bookCoverUrl = cover_url || '';
    if (coverFile) {
      try {
        const coverPath = `covers/${Date.now()}_${coverFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: coverErr } = await supabase.storage
          .from('documentos')
          .upload(coverPath, coverFile.buffer, {
            contentType: coverFile.mimetype || 'image/jpeg',
            upsert: false,
          });
        if (!coverErr) {
          const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(coverPath);
          bookCoverUrl = urlData.publicUrl;
        }
      } catch (coverUpErr) {
        console.error('❌ Cover upload exception:', coverUpErr.message);
      }
    }

    // If no cover provided, save a temporary placeholder (non-blocking)
    // Real cover will be the first page of the uploaded document (extracted in background)
    let needsAutoCover = false;
    if (!bookCoverUrl && bookFileUrl) {
      // Use a temp placeholder with 'pending' - will be replaced with first page of document after book creation
      bookCoverUrl = coverService.savePlaceholderCover(
        title.trim(), author.trim(), category, 'pending'
      );
      needsAutoCover = true;
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

    // Respond immediately — don't wait for cover generation
    res.status(201).json({ book });

    // Generate real cover in background (non-blocking)
    if (needsAutoCover) {
      const generateWithRetry = async () => {
        try {
          const realCover = await coverService.autoGenerateCover(
            title.trim(), author.trim(), category, book.id, bookFileUrl, 3
          );
          if (realCover && realCover !== bookCoverUrl) {
            await Store.updateBookCover(book.id, realCover);
            console.log(`🖼️ Background cover generated for "${title}":`, realCover);
          }
        } catch (err) {
          console.error(`⚠️ Background cover generation failed for "${title}":`, err.message);
        }
      };
      generateWithRetry();
    }
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

    console.log(`❤️ Toggle favorite: user=${req.session.user.id}, book=${req.params.id}`);
    const added = await Store.toggleFavorite(req.session.user.id, req.params.id);
    console.log(`❤️ Favorite result: added=${added}`);
    const count = await Store.favoriteCount(req.params.id);
    console.log(`❤️ Favorite count for book ${req.params.id}: ${count}`);
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
