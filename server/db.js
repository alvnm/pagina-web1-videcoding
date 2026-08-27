/* ============================================
   Store — Supabase database persistence
   ============================================ */

const bcrypt = require('bcryptjs');
const supabase = require('./supabase');

// ---- Helpers ----

function _enrichBook(book) {
  if (!book) return null;
  return {
    ...book,
    tags: book._tags || [],
    uploader_name: book._uploader_name || 'Desconocido',
  };
}

// Public query API
const Store = {
  // ===================== Users =====================

  async findUserByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('❌ findUserByEmail error:', error.message);
    }
    return (data && data.length > 0) ? data[0] : null;
  },

  async findUserById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .eq('id', id)
      .limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('❌ findUserById error:', error.message);
    }
    return (data && data.length > 0) ? data[0] : null;
  },

  async findUserByIdFull(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .limit(1);
    if (error && error.code !== 'PGRST116') {
      console.error('❌ findUserByIdFull error:', error.message);
    }
    return (data && data.length > 0) ? data[0] : null;
  },

  async createUser(name, email, hashedPassword) {
    const { data, error } = await supabase
      .from('users')
      .insert({ name, email: email.toLowerCase(), password: hashedPassword, role: 'user', created_at: new Date().toISOString().slice(0, 10) })
      .select('id, name, email, role, created_at')
      .single();
    if (error) {
      console.error('❌ Supabase createUser error:', error.message, 'Code:', error.code, 'Details:', error.details);
      throw error;
    }
    return data;
  },

  async updateUser(userId, updates) {
    const { data, error: fetchError } = await supabase.from('users').select('*').eq('id', userId).limit(1);
    const user = (data && data.length > 0) ? data[0] : null;
    if (!user) return null;

    const patch = {};
    if (updates.name && updates.name.trim()) {
      patch.name = updates.name.trim();
    }
    if (updates.email && updates.email.trim()) {
      const newEmail = updates.email.trim().toLowerCase();
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .ilike('email', newEmail)
        .neq('id', userId)
        .limit(1);
      if (existing && existing.length > 0) return { error: 'email_taken' };
      patch.email = newEmail;
    }
    if (updates.password) {
      patch.password = bcrypt.hashSync(updates.password, 10);
    }

    if (Object.keys(patch).length === 0) {
      return { id: user.id, name: user.name, email: user.email, created_at: user.created_at };
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select('id, name, email, created_at');
    if (updateError) console.error('❌ updateUser error:', updateError.message);
    const updated = (updatedData && updatedData.length > 0) ? updatedData[0] : null;

    return updated || { id: user.id, name: patch.name || user.name, email: patch.email || user.email, created_at: user.created_at };
  },

  // ===================== Books =====================

  async _enrichBooks(books) {
    if (!books || books.length === 0) return [];
    const enriched = [];
    for (const book of books) {
      // Tags are stored as ARRAY in the books table
      const tags = Array.isArray(book.tags) ? book.tags : [];
      // Get uploader name from user_id
      let uploaderName = 'Desconocido';
      if (book.user_id) {
        const { data: uploader } = await supabase.from('users').select('name').eq('id', book.user_id).single();
        if (uploader) uploaderName = uploader.name;
      }
      enriched.push({ ...book, tags, uploader_name: uploaderName });
    }
    return enriched;
  },

  async allBooks() {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false });
    return this._enrichBooks(data || []);
  },

  async bookById(id) {
    const { data: book } = await supabase.from('books').select('*').eq('id', id).single();
    if (!book) return null;
    const [enriched] = await this._enrichBooks([book]);
    return enriched;
  },

  async booksByUser(userId) {
    const { data } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return this._enrichBooks(data || []);
  },

  async searchBooks({ query = '', category = '' } = {}) {
    let q = supabase.from('books').select('*');

    if (category) {
      q = q.eq('category', category);
    }

    if (query.trim()) {
      const search = query.toLowerCase().trim();
      q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
    }

    const { data } = await q.order('created_at', { ascending: false });
    let books = await this._enrichBooks(data || []);

    // Filter by tags if query exists
    if (query.trim()) {
      const search = query.toLowerCase().trim();
      books = books.filter(b =>
        b.title.toLowerCase().includes(search) ||
        b.author.toLowerCase().includes(search) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(search)))
      );
    }

    return books;
  },

  async searchBooksPaginated({ query = '', category = '', page = 1, perPage = 12 } = {}) {
    let q = supabase.from('books').select('*', { count: 'exact' });

    if (category) {
      q = q.eq('category', category);
    }

    if (query.trim()) {
      const search = query.toLowerCase().trim();
      q = q.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
    }

    const { data, count } = await q
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    let books = await this._enrichBooks(data || []);

    // Filter by tags if query exists
    if (query.trim()) {
      const search = query.toLowerCase().trim();
      books = books.filter(b =>
        b.title.toLowerCase().includes(search) ||
        b.author.toLowerCase().includes(search) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(search)))
      );
    }

    const total = count || books.length;
    const totalPages = Math.ceil(total / perPage);
    return { books, total, page, totalPages, perPage };
  },

  async createBook({ title, author, category, description, file_url, cover_url, user_id, tags }) {
    const { data: book, error } = await supabase
      .from('books')
      .insert({
        title,
        author,
        category,
        description: description || '',
        file_url: file_url || '',
        cover_url: cover_url || '',
        user_id: user_id,
        tags: tags || [],
        created_at: new Date().toISOString(),
        downloads: 0,
      })
      .select('*')
      .single();
    if (error) {
      console.error('❌ Supabase createBook error:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error details:', error.details);
      throw error;
    }

    const [enriched] = await this._enrichBooks([book]);
    return enriched;
  },

  async incrementDownload(bookId) {
    // First get current count
    const { data: book } = await supabase.from('books').select('downloads').eq('id', bookId).single();
    if (!book) return 0;
    const newCount = (book.downloads || 0) + 1;
    await supabase.from('books').update({ downloads: newCount }).eq('id', bookId);
    return newCount;
  },

  async updateBook(bookId, userId, updates) {
    const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
    if (!book) return null;
    if (book.user_id !== userId) return { error: 'forbidden' };

    const patch = {};
    const allowed = ['title', 'author', 'category', 'description'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        patch[key] = String(updates[key]).trim();
      }
    }

    // Handle cover_url
    if (updates.cover_url !== undefined) {
      patch.cover_url = updates.cover_url;
    }

    // Update tags if provided (stored as ARRAY)
    if (updates.tags && Array.isArray(updates.tags)) {
      patch.tags = updates.tags;
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from('books').update(patch).eq('id', bookId);
    }

    const updatedBook = { ...book, ...patch };
    const [enriched] = await this._enrichBooks([updatedBook]);
    return enriched;
  },

  async deleteBook(bookId, userId) {
    const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
    if (!book) return { error: 'not_found' };
    if (book.user_id !== userId) return { error: 'forbidden' };

    await supabase.from('books').delete().eq('id', bookId);
    return { deleted: true, file_url: book.file_url };
  },

  // ===================== Stats =====================

  async getStats() {
    const { count: totalBooks } = await supabase.from('books').select('*', { count: 'exact', head: true });
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { data: books } = await supabase.from('books').select('downloads');
    const totalDownloads = (books || []).reduce((sum, b) => sum + (b.downloads || 0), 0);
    return { totalBooks: totalBooks || 0, totalUsers: totalUsers || 0, totalDownloads };
  },

  async getCategories() {
    return ['Ficción', 'Ciencia', 'Historia', 'Educación', 'Tecnología', 'Arte', 'Filosofía'];
  },

  async mostDownloaded(limit = 6) {
    const { data } = await supabase.from('books').select('*').order('downloads', { ascending: false }).limit(limit);
    return this._enrichBooks(data || []);
  },

  async categoriesWithCounts() {
    const { data: books } = await supabase.from('books').select('category');
    const cats = {};
    for (const book of (books || [])) {
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

  async recentBooks(limit = 6) {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false }).limit(limit);
    return this._enrichBooks(data || []);
  },

  // ===================== Favorites =====================

  async toggleFavorite(userId, bookId) {
    const { data: existing } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('book_id', bookId);
      return false; // removed
    } else {
      await supabase.from('favorites').insert({ user_id: userId, book_id: bookId, created_at: new Date().toISOString() });
      return true; // added
    }
  },

  async isFavorite(userId, bookId) {
    const { data } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .limit(1);
    return data && data.length > 0;
  },

  async favoritesByUser(userId) {
    const { data: favRows } = await supabase.from('favorites').select('book_id').eq('user_id', userId);
    if (!favRows || favRows.length === 0) return [];
    const bookIds = favRows.map(f => f.book_id);
    const { data: books } = await supabase.from('books').select('*').in('id', bookIds);
    return this._enrichBooks(books || []);
  },

  async favoriteCount(bookId) {
    const { count } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', bookId);
    return count || 0;
  },

  // ===================== Reading History =====================

  async addReadingHistory(userId, bookId) {
    // Upsert: delete existing and insert new
    await supabase.from('reading_history').delete().eq('user_id', userId).eq('book_id', bookId);
    await supabase.from('reading_history').insert({ user_id: userId, book_id: bookId, viewed_at: new Date().toISOString() });
    // Keep max 20 per user
    const { data: history } = await supabase
      .from('reading_history')
      .select('id')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false });
    if (history && history.length > 20) {
      const toRemove = history.slice(20).map(h => h.id);
      await supabase.from('reading_history').delete().in('id', toRemove);
    }
  },

  async readingHistoryByUser(userId) {
    const { data: historyRows } = await supabase
      .from('reading_history')
      .select('book_id, viewed_at')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(10);
    if (!historyRows || historyRows.length === 0) return [];
    const results = [];
    for (const h of historyRows) {
      const book = await this.bookById(h.book_id);
      if (book) results.push({ ...book, viewed_at: h.viewed_at });
    }
    return results;
  },

  // ===================== Ratings =====================

  async setRating(userId, bookId, score) {
    score = Math.max(0.5, Math.min(5, Math.round(Number(score) * 2) / 2));

    const { data: existing } = await supabase
      .from('ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase.from('ratings').update({ score, created_at: new Date().toISOString() }).eq('user_id', userId).eq('book_id', bookId);
    } else {
      await supabase.from('ratings').insert({ user_id: userId, book_id: bookId, score, created_at: new Date().toISOString() });
    }
    return this.getRatingStats(bookId);
  },

  async getRatingStats(bookId) {
    const { data: ratings } = await supabase.from('ratings').select('score').eq('book_id', bookId);
    if (!ratings || ratings.length === 0) return { average: 0, count: 0, distribution: {} };
    const sum = ratings.reduce((s, r) => s + Number(r.score), 0);
    const distribution = {};
    for (const r of ratings) {
      const key = String(Number(r.score));
      distribution[key] = (distribution[key] || 0) + 1;
    }
    return {
      average: Math.round((sum / ratings.length) * 2) / 2,
      count: ratings.length,
      distribution,
    };
  },

  async getUserRating(userId, bookId) {
    const { data } = await supabase
      .from('ratings')
      .select('score')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .limit(1)
      .single();
    return data ? data.score : 0;
  },

  // ===================== Comments =====================

  async getComments(bookId, { page = 1, perPage = 20 } = {}) {
    const offset = (page - 1) * perPage;

    const { data: comments, count: total } = await supabase
      .from('comments')
      .select('*', { count: 'exact' })
      .eq('book_id', bookId)
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    // Enrich with user names
    const enriched = [];
    for (const c of (comments || [])) {
      let userName = 'Anónimo';
      if (c.user_id) {
        const { data: user } = await supabase.from('users').select('name').eq('id', c.user_id).single();
        if (user) userName = user.name;
      }
      enriched.push({ ...c, user_name: userName });
    }

    const totalPages = Math.ceil((total || 0) / perPage);
    return { comments: enriched, total: total || 0, page, totalPages };
  },

  async addComment(userId, bookId, text) {
    if (!text || !text.trim()) return null;

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({ user_id: userId, book_id: bookId, text: text.trim(), created_at: new Date().toISOString() })
      .select('*')
      .single();
    if (error) throw error;

    let userName = 'Anónimo';
    const { data: user } = await supabase.from('users').select('name').eq('id', userId).single();
    if (user) userName = user.name;

    return { ...comment, user_name: userName };
  },

  async deleteComment(commentId, userId) {
    const { data: comment } = await supabase.from('comments').select('*').eq('id', commentId).single();
    if (!comment) return { error: 'not_found' };
    if (comment.user_id !== userId) return { error: 'forbidden' };
    await supabase.from('comments').delete().eq('id', commentId);
    return { deleted: true };
  },

  // ===================== Views =====================

  async addView(userId, bookId) {
    const { data: book } = await supabase.from('books').select('downloads').eq('id', bookId).single();
    if (!book) return null;
    if (userId) {
      await this.addReadingHistory(userId, bookId);
    }
    return book.downloads || 0;
  },

  // ===================== Admin =====================

  async isAdmin(userId) {
    const { data: user } = await supabase.from('users').select('role').eq('id', userId).single();
    return user && user.role === 'admin';
  },

  async getAllUsers() {
    const { data: users } = await supabase.from('users').select('id, name, email, role, created_at');
    const result = [];
    for (const u of (users || [])) {
      const { count: bookCount } = await supabase.from('books').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
      const { data: userBooks } = await supabase.from('books').select('downloads').eq('user_id', u.id);
      const totalDownloads = (userBooks || []).reduce((s, b) => s + (b.downloads || 0), 0);
      const { count: favoriteCount } = await supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
      const { count: commentCount } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
      result.push({
        ...u,
        bookCount: bookCount || 0,
        totalDownloads,
        favoriteCount: favoriteCount || 0,
        commentCount: commentCount || 0,
      });
    }
    return result;
  },

  async adminDeleteBook(bookId) {
    const { data: book } = await supabase.from('books').select('*').eq('id', bookId).single();
    if (!book) return { error: 'not_found' };
    await supabase.from('books').delete().eq('id', bookId);
    return { deleted: true, file_url: book.file_url };
  },

  async adminDeleteUser(userId) {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) return { error: 'not_found' };

    // Don't allow deleting the last admin
    if (user.role === 'admin') {
      const { count: adminCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin');
      if ((adminCount || 0) <= 1) return { error: 'last_admin' };
    }

    // Get books by this user for cleanup
    const { data: userBooks } = await supabase.from('books').select('file_url').eq('user_id', userId);
    const deletedFileUrls = (userBooks || []).map(b => b.file_url);

    await supabase.from('users').delete().eq('id', userId);
    return { deleted: true, deletedFileUrls };
  },

  async adminSetUserRole(userId, role) {
    if (!['admin', 'user'].includes(role)) return { error: 'invalid_role' };

    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) return { error: 'not_found' };

    // Don't allow removing last admin's role
    if (user.role === 'admin' && role !== 'admin') {
      const { count: adminCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin');
      if ((adminCount || 0) <= 1) return { error: 'last_admin' };
    }

    await supabase.from('users').update({ role }).eq('id', userId);
    return { id: user.id, name: user.name, email: user.email, role };
  },

  async getAdminStats() {
    const { count: totalBooks } = await supabase.from('books').select('*', { count: 'exact', head: true });
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { data: books } = await supabase.from('books').select('downloads');
    const totalDownloads = (books || []).reduce((s, b) => s + (b.downloads || 0), 0);
    const { count: totalComments } = await supabase.from('comments').select('*', { count: 'exact', head: true });
    const { count: totalRatings } = await supabase.from('ratings').select('*', { count: 'exact', head: true });
    const { count: totalFavorites } = await supabase.from('favorites').select('*', { count: 'exact', head: true });

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { data: recentBooks } = await supabase.from('books').select('created_at').gte('created_at', thisMonth);
    const { data: recentUsers } = await supabase.from('users').select('created_at').gte('created_at', thisMonth);

    return {
      totalBooks: totalBooks || 0,
      totalUsers: totalUsers || 0,
      totalDownloads,
      totalComments: totalComments || 0,
      totalRatings: totalRatings || 0,
      totalFavorites: totalFavorites || 0,
      booksThisMonth: (recentBooks || []).length,
      usersThisMonth: (recentUsers || []).length,
    };
  },
};

module.exports = Store;
