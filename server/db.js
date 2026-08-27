/* ============================================
   Store — JSON file persistence (zero native deps)
   ============================================ */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'biblioteca.json');

// ---- Helpers ----
let _canWrite = true;

function _readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function _writeDB(data) {
  if (!_canWrite) return; // Silently skip on read-only filesystem (e.g. Vercel)
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️  No se pudo escribir la base de datos:', err.message);
    _canWrite = false;
  }
}

function _nextId(collection) {
  const items = _db[collection] || [];
  if (items.length === 0) return 1;
  return Math.max(...items.map(i => i.id)) + 1;
}

// ---- In-memory DB ----
let _db = _readDB();

function _seedIfEmpty() {
  if (_db && _db.users && _db.users.length > 0) {
    // Ensure new collections exist even on old DB files
    if (!_db.favorites) _db.favorites = [];
    if (!_db.reading_history) _db.reading_history = [];
    if (!_db.ratings) _db.ratings = [];
    if (!_db.comments) _db.comments = [];
    return;
  }

  _db = {
    users: [],
    books: [],
    tags: [],
    favorites: [],
    reading_history: [],
    ratings: [],
    comments: [],
  };

  _writeDB(_db);
  console.log('✅ Database initialized (empty)');
}

// Ensure collections exist on existing DB files
if (_db && !_db.favorites) { _db.favorites = []; _writeDB(_db); }
if (_db && !_db.reading_history) { _db.reading_history = []; _writeDB(_db); }
if (_db && !_db.ratings) { _db.ratings = []; _writeDB(_db); }
if (_db && !_db.comments) { _db.comments = []; _writeDB(_db); }

_seedIfEmpty();

// ---- Query helpers ----
function _getTagsForBook(bookId) {
  return (_db.tags || []).filter(t => t.book_id === bookId).map(t => t.tag);
}

function _enrichBook(book) {
  if (!book) return null;
  const uploader = _db.users.find(u => u.id === book.uploader_id);
  return {
    ...book,
    tags: _getTagsForBook(book.id),
    uploader_name: uploader ? uploader.name : 'Desconocido',
  };
}

// Public query API
const Store = {
  // Users
  findUserByEmail(email) {
    return _db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  findUserById(id) {
    const u = _db.users.find(u => u.id === Number(id));
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role || 'user', created_at: u.created_at };
  },

  createUser(name, email, hashedPassword) {
    const id = _nextId('users');
    const user = { id, name, email: email.toLowerCase(), password: hashedPassword, role: 'user', created_at: new Date().toISOString().slice(0, 10) };
    _db.users.push(user);
    _writeDB(_db);
    return { id, name, email: user.email, role: user.role, created_at: user.created_at };
  },

  // Books
  allBooks() {
    return [..._db.books].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(_enrichBook);
  },

  bookById(id) {
    return _enrichBook(_db.books.find(b => b.id === Number(id)));
  },

  booksByUser(userId) {
    return _db.books
      .filter(b => b.uploader_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(_enrichBook);
  },

  searchBooks({ query = '', category = '' } = {}) {
    let books = [..._db.books];

    if (category) {
      books = books.filter(b => b.category === category);
    }

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      books = books.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        _getTagsForBook(b.id).some(t => t.toLowerCase().includes(q))
      );
    }

    return books.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(_enrichBook);
  },

  createBook({ title, author, category, description, file_type, file_name, file_path, uploader_id, tags }) {
    const id = _nextId('books');
    const book = {
      id,
      title,
      author,
      category,
      description: description || '',
      file_type: file_type || 'PDF',
      file_name: file_name || '',
      file_path: file_path || '',
      uploader_id: Number(uploader_id),
      created_at: new Date().toISOString().slice(0, 10),
      downloads: 0,
    };
    _db.books.push(book);

    // Tags
    if (tags && tags.length) {
      for (const tag of tags) {
        if (tag.trim()) {
          _db.tags.push({ book_id: id, tag: tag.trim() });
        }
      }
    }

    _writeDB(_db);
    return _enrichBook(book);
  },

  incrementDownload(bookId) {
    const book = _db.books.find(b => b.id === Number(bookId));
    if (book) {
      book.downloads = (book.downloads || 0) + 1;
      _writeDB(_db);
    }
    return book ? book.downloads : 0;
  },

  // Stats
  getStats() {
    return {
      totalBooks: _db.books.length,
      totalUsers: _db.users.length,
      totalDownloads: _db.books.reduce((sum, b) => sum + (b.downloads || 0), 0),
    };
  },

  // Categories (static)
  getCategories() {
    return ['Ficción', 'Ciencia', 'Historia', 'Educación', 'Tecnología', 'Arte', 'Filosofía'];
  },

  // Most downloaded books
  mostDownloaded(limit = 6) {
    return [..._db.books]
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, limit)
      .map(_enrichBook);
  },

  // Categories with counts
  categoriesWithCounts() {
    const cats = {};
    for (const book of _db.books) {
      cats[book.category] = (cats[book.category] || 0) + 1;
    }
    const icons = {
      'Ficción': '📚', 'Ciencia': '🔬', 'Historia': '🏛️', 'Educación': '🎓',
      'Tecnología': '💻', 'Arte': '🎨', 'Filosofía': '🧠',
    };
    return Object.entries(cats).map(([name, count]) => ({
      name,
      count,
      icon: icons[name] || '📖',
    })).sort((a, b) => b.count - a.count);
  },

  // Favorites
  toggleFavorite(userId, bookId) {
    userId = Number(userId);
    bookId = Number(bookId);
    const idx = _db.favorites.findIndex(f => f.user_id === userId && f.book_id === bookId);
    if (idx >= 0) {
      _db.favorites.splice(idx, 1);
      _writeDB(_db);
      return false; // removed
    } else {
      _db.favorites.push({ user_id: userId, book_id: bookId, created_at: new Date().toISOString() });
      _writeDB(_db);
      return true; // added
    }
  },

  isFavorite(userId, bookId) {
    return _db.favorites.some(f => f.user_id === Number(userId) && f.book_id === Number(bookId));
  },

  favoritesByUser(userId) {
    const favIds = _db.favorites
      .filter(f => f.user_id === Number(userId))
      .map(f => f.book_id);
    return favIds.map(id => _enrichBook(_db.books.find(b => b.id === id))).filter(Boolean);
  },

  favoriteCount(bookId) {
    return _db.favorites.filter(f => f.book_id === Number(bookId)).length;
  },

  // Reading history
  addReadingHistory(userId, bookId) {
    userId = Number(userId);
    bookId = Number(bookId);
    // Remove existing entry for this user+book (move to front)
    _db.reading_history = _db.reading_history.filter(
      h => !(h.user_id === userId && h.book_id === bookId)
    );
    _db.reading_history.unshift({
      user_id: userId,
      book_id: bookId,
      viewed_at: new Date().toISOString(),
    });
    // Keep max 20 per user
    const userHistory = _db.reading_history.filter(h => h.user_id === userId);
    if (userHistory.length > 20) {
      const toRemove = userHistory.slice(20);
      for (const item of toRemove) {
        const ri = _db.reading_history.indexOf(item);
        if (ri >= 0) _db.reading_history.splice(ri, 1);
      }
    }
    _writeDB(_db);
  },

  readingHistoryByUser(userId) {
    return _db.reading_history
      .filter(h => h.user_id === Number(userId))
      .slice(0, 10)
      .map(h => ({ ..._enrichBook(_db.books.find(b => b.id === h.book_id)), viewed_at: h.viewed_at }))
      .filter(h => h.id);
  },

  // Paginated books
  searchBooksPaginated({ query = '', category = '', page = 1, perPage = 12 } = {}) {
    let books = [..._db.books];
    if (category) {
      books = books.filter(b => b.category === category);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      books = books.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        _getTagsForBook(b.id).some(t => t.toLowerCase().includes(q))
      );
    }
    books.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = books.length;
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;
    const paginated = books.slice(offset, offset + perPage).map(_enrichBook);
    return { books: paginated, total, page, totalPages, perPage };
  },

  // Recent books (last N)
  recentBooks(limit = 6) {
    return [..._db.books]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(_enrichBook);
  },

  // Delete book (owner only)
  deleteBook(bookId, userId) {
    bookId = Number(bookId);
    userId = Number(userId);
    const idx = _db.books.findIndex(b => b.id === bookId);
    if (idx < 0) return { error: 'not_found' };
    if (_db.books[idx].uploader_id !== userId) return { error: 'forbidden' };

    const book = _db.books[idx];
    _db.books.splice(idx, 1);

    // Clean up related data
    _db.tags = _db.tags.filter(t => t.book_id !== bookId);
    _db.favorites = _db.favorites.filter(f => f.book_id !== bookId);
    _db.reading_history = _db.reading_history.filter(h => h.book_id !== bookId);
    _db.ratings = _db.ratings.filter(r => r.book_id !== bookId);
    _db.comments = _db.comments.filter(c => c.book_id !== bookId);

    _writeDB(_db);
    return { deleted: true, file_path: book.file_path };
  },

  // Update book (owner only)
  updateBook(bookId, userId, updates) {
    bookId = Number(bookId);
    userId = Number(userId);
    const book = _db.books.find(b => b.id === bookId);
    if (!book) return null;
    if (book.uploader_id !== userId) return { error: 'forbidden' };

    const allowed = ['title', 'author', 'category', 'description'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        book[key] = String(updates[key]).trim();
      }
    }

    // Update tags if provided
    if (updates.tags && Array.isArray(updates.tags)) {
      _db.tags = _db.tags.filter(t => t.book_id !== bookId);
      for (const tag of updates.tags) {
        if (tag && tag.trim()) {
          _db.tags.push({ book_id: bookId, tag: tag.trim() });
        }
      }
    }

    _writeDB(_db);
    return _enrichBook(book);
  },

  // Update user profile
  updateUser(userId, updates) {
    userId = Number(userId);
    const user = _db.users.find(u => u.id === userId);
    if (!user) return null;

    if (updates.name && updates.name.trim()) {
      user.name = updates.name.trim();
    }
    if (updates.email && updates.email.trim()) {
      // Check email uniqueness
      const existing = _db.users.find(u => u.email === updates.email.trim().toLowerCase() && u.id !== userId);
      if (existing) return { error: 'email_taken' };
      user.email = updates.email.trim().toLowerCase();
    }
    if (updates.password) {
      user.password = bcrypt.hashSync(updates.password, 10);
    }

    _writeDB(_db);
    return { id: user.id, name: user.name, email: user.email, created_at: user.created_at };
  },

  // ---- Ratings ----
  setRating(userId, bookId, score) {
    userId = Number(userId);
    bookId = Number(bookId);
    score = Math.max(1, Math.min(5, Math.round(Number(score))));

    const existing = _db.ratings.find(r => r.user_id === userId && r.book_id === bookId);
    if (existing) {
      existing.score = score;
      existing.created_at = new Date().toISOString();
    } else {
      _db.ratings.push({ user_id: userId, book_id: bookId, score, created_at: new Date().toISOString() });
    }
    _writeDB(_db);
    return this.getRatingStats(bookId);
  },

  getRatingStats(bookId) {
    bookId = Number(bookId);
    const ratings = _db.ratings.filter(r => r.book_id === bookId);
    if (ratings.length === 0) return { average: 0, count: 0, distribution: {1:0,2:0,3:0,4:0,5:0} };
    const sum = ratings.reduce((s, r) => s + r.score, 0);
    const distribution = {1:0,2:0,3:0,4:0,5:0};
    for (const r of ratings) distribution[r.score]++;
    return {
      average: Math.round((sum / ratings.length) * 10) / 10,
      count: ratings.length,
      distribution,
    };
  },

  getUserRating(userId, bookId) {
    const r = _db.ratings.find(r => r.user_id === Number(userId) && r.book_id === Number(bookId));
    return r ? r.score : 0;
  },

  // ---- Comments ----
  getComments(bookId, { page = 1, perPage = 20 } = {}) {
    bookId = Number(bookId);
    let comments = _db.comments
      .filter(c => c.book_id === bookId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = comments.length;
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;
    comments = comments.slice(offset, offset + perPage);

    // Enrich with user names
    const enriched = comments.map(c => {
      const user = _db.users.find(u => u.id === c.user_id);
      return { ...c, user_name: user ? user.name : 'Anónimo' };
    });

    return { comments: enriched, total, page, totalPages };
  },

  addComment(userId, bookId, text) {
    userId = Number(userId);
    bookId = Number(bookId);
    if (!text || !text.trim()) return null;

    const id = _nextId('comments');
    const comment = {
      id,
      user_id: userId,
      book_id: bookId,
      text: text.trim(),
      created_at: new Date().toISOString(),
    };
    _db.comments.push(comment);
    _writeDB(_db);

    const user = _db.users.find(u => u.id === userId);
    return { ...comment, user_name: user ? user.name : 'Anónimo' };
  },

  deleteComment(commentId, userId) {
    commentId = Number(commentId);
    userId = Number(userId);
    const idx = _db.comments.findIndex(c => c.id === commentId);
    if (idx < 0) return { error: 'not_found' };
    if (_db.comments[idx].user_id !== userId) return { error: 'forbidden' };
    _db.comments.splice(idx, 1);
    _writeDB(_db);
    return { deleted: true };
  },

  // ---- Views tracking ----
  addView(userId, bookId) {
    bookId = Number(bookId);
    const book = _db.books.find(b => b.id === bookId);
    if (!book) return null;
    if (userId) {
      this.addReadingHistory(Number(userId), bookId);
    }
    return book.downloads || 0;
  },

  // ---- Admin methods ----
  isAdmin(userId) {
    const user = _db.users.find(u => u.id === Number(userId));
    return user && (user.role === 'admin');
  },

  getAllUsers() {
    return _db.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'user',
      created_at: u.created_at,
      bookCount: _db.books.filter(b => b.uploader_id === u.id).length,
      totalDownloads: _db.books.filter(b => b.uploader_id === u.id).reduce((s, b) => s + (b.downloads || 0), 0),
      favoriteCount: _db.favorites.filter(f => f.user_id === u.id).length,
      commentCount: _db.comments.filter(c => c.user_id === u.id).length,
    }));
  },

  adminDeleteBook(bookId) {
    bookId = Number(bookId);
    const idx = _db.books.findIndex(b => b.id === bookId);
    if (idx < 0) return { error: 'not_found' };

    const book = _db.books[idx];
    _db.books.splice(idx, 1);

    // Clean up related data
    _db.tags = _db.tags.filter(t => t.book_id !== bookId);
    _db.favorites = _db.favorites.filter(f => f.book_id !== bookId);
    _db.reading_history = _db.reading_history.filter(h => h.book_id !== bookId);
    _db.ratings = _db.ratings.filter(r => r.book_id !== bookId);
    _db.comments = _db.comments.filter(c => c.book_id !== bookId);

    _writeDB(_db);
    return { deleted: true, file_path: book.file_path };
  },

  adminDeleteUser(userId) {
    userId = Number(userId);
    const idx = _db.users.findIndex(u => u.id === userId);
    if (idx < 0) return { error: 'not_found' };

    // Don't allow deleting the last admin
    const user = _db.users[idx];
    if (user.role === 'admin') {
      const adminCount = _db.users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) return { error: 'last_admin' };
    }

    _db.users.splice(idx, 1);

    // Clean up user data
    _db.favorites = _db.favorites.filter(f => f.user_id !== userId);
    _db.reading_history = _db.reading_history.filter(h => h.user_id !== userId);
    _db.ratings = _db.ratings.filter(r => r.user_id !== userId);
    _db.comments = _db.comments.filter(c => c.user_id !== userId);

    // Delete books uploaded by this user
    const userBooks = _db.books.filter(b => b.uploader_id === userId);
    const deletedFilePaths = [];
    for (const book of userBooks) {
      deletedFilePaths.push(book.file_path);
    }
    _db.books = _db.books.filter(b => b.uploader_id !== userId);

    // Clean orphaned tags
    const bookIds = new Set(_db.books.map(b => b.id));
    _db.tags = _db.tags.filter(t => bookIds.has(t.book_id));

    _writeDB(_db);
    return { deleted: true, deletedFilePaths };
  },

  adminSetUserRole(userId, role) {
    userId = Number(userId);
    if (!['admin', 'user'].includes(role)) return { error: 'invalid_role' };

    const user = _db.users.find(u => u.id === userId);
    if (!user) return { error: 'not_found' };

    // Don't allow removing last admin's role
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = _db.users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) return { error: 'last_admin' };
    }

    user.role = role;
    _writeDB(_db);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  },

  getAdminStats() {
    const totalBooks = _db.books.length;
    const totalUsers = _db.users.length;
    const totalDownloads = _db.books.reduce((s, b) => s + (b.downloads || 0), 0);
    const totalComments = _db.comments.length;
    const totalRatings = _db.ratings.length;
    const totalFavorites = _db.favorites.length;
    const booksThisMonth = _db.books.filter(b => {
      const d = new Date(b.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const usersThisMonth = _db.users.filter(u => {
      const d = new Date(u.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return {
      totalBooks, totalUsers, totalDownloads,
      totalComments, totalRatings, totalFavorites,
      booksThisMonth, usersThisMonth,
    };
  },
};

module.exports = Store;
