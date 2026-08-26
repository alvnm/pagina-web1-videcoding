/* ============================================
   Store — API client (talks to Express backend)
   ============================================ */

// Configuración de Supabase
const SUPABASE_URL = 'https://nhjmpulzxfpezlseqrtj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FCfSaP3eX3XmLFD525J-Vw_pUibeo53';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Store = (() => {
  const API = '/api';
  const supabase = supabaseClient; // acceso interno al cliente Supabase

  // ---- Generic fetch helper ----
  async function _get(url) {
    const res = await fetch(API + url, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  }

  async function _post(url, body) {
    const res = await fetch(API + url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  }

  // ---- Auth ----
  async function registerUser({ name, email, password }) {
    return _post('/auth/register', { name, email, password });
  }

  async function loginUser({ email, password }) {
    return _post('/auth/login', { email, password });
  }

  async function logoutUser() {
    return _post('/auth/logout');
  }

  async function getSession() {
    try {
      const data = await _get('/auth/me');
      return data.user || null;
    } catch {
      return null;
    }
  }

  // ---- Books ----
  async function searchBooks({ query = '', category = '' } = {}) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    const qs = params.toString();
    const data = await _get('/books' + (qs ? '?' + qs : ''));
    return data.books || [];
  }

  async function searchBooksPaginated({ query = '', category = '', page = 1, perPage = 12 } = {}) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    params.set('page', page);
    params.set('per_page', perPage);
    const data = await _get('/books?' + params.toString());
    return data; // { books, total, page, totalPages, perPage }
  }

  async function getBookById(id) {
    const data = await _get('/books/' + id);
    return data.book || null;
  }

  async function addBook(formData) {
    const res = await fetch(API + '/books', {
      method: 'POST',
      credentials: 'include',
      body: formData, // FormData — browser sets Content-Type with boundary
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir');
    return data;
  }

  async function incrementDownload(bookId) {
    return _post('/books/' + bookId + '/download');
  }

  // ---- Favorites ----
  async function toggleFavorite(bookId) {
    return _post('/books/' + bookId + '/favorite');
  }

  async function getUserFavorites(userId) {
    const data = await _get('/users/' + userId + '/favorites');
    return data.favorites || [];
  }

  // ---- Reading History ----
  async function getUserHistory(userId) {
    const data = await _get('/users/' + userId + '/history');
    return data.history || [];
  }

  // ---- Most Downloaded ----
  async function getMostDownloaded(limit = 6) {
    const data = await _get('/books/most-downloaded?limit=' + limit);
    return data.books || [];
  }

  // ---- Recent Books ----
  async function getRecentBooks(limit = 6) {
    const data = await _get('/books/recent?limit=' + limit);
    return data.books || [];
  }

  // ---- Users ----
  async function getUserProfile(id) {
    const data = await _get('/users/' + id);
    return data; // { user, books, stats }
  }

  async function updateUserProfile(id, updates) {
    const res = await fetch(API + '/users/' + id, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar perfil');
    return data;
  }

  async function getStats() {
    return _get('/users/stats');
  }

  // ---- Book CRUD ----
  async function deleteBook(bookId) {
    const res = await fetch(API + '/books/' + bookId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');
    return data;
  }

  async function updateBook(bookId, updates) {
    const res = await fetch(API + '/books/' + bookId, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar');
    return data;
  }

  // ---- Ratings ----
  async function rateBook(bookId, score) {
    const res = await fetch(API + '/books/' + bookId + '/rate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al calificar');
    return data;
  }

  async function getBookRating(bookId) {
    const data = await _get('/books/' + bookId + '/rating');
    return data; // { rating: {average, count, distribution}, userRating }
  }

  // ---- Comments ----
  async function getBookComments(bookId, page = 1) {
    const data = await _get('/books/' + bookId + '/comments?page=' + page);
    return data; // { comments, total, page, totalPages }
  }

  async function addBookComment(bookId, text) {
    const res = await fetch(API + '/books/' + bookId + '/comments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al comentar');
    return data;
  }

  async function deleteBookComment(bookId, commentId) {
    const res = await fetch(API + '/books/' + bookId + '/comments/' + commentId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar comentario');
    return data;
  }

  // ---- View tracking ----
  async function trackView(bookId) {
    try {
      await _post('/books/' + bookId + '/view');
    } catch { /* ignore */ }
  }

  // ---- Admin ----
  async function getAdminStats() {
    return _get('/admin/stats');
  }

  async function getAdminUsers() {
    const data = await _get('/admin/users');
    return data.users || [];
  }

  async function getAdminBooks() {
    const data = await _get('/admin/books');
    return data.books || [];
  }

  async function adminDeleteUser(userId) {
    const res = await fetch(API + '/admin/users/' + userId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');
    return data;
  }

  async function adminDeleteBook(bookId) {
    const res = await fetch(API + '/admin/books/' + bookId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar libro');
    return data;
  }

  async function adminSetUserRole(userId, role) {
    const res = await fetch(API + '/admin/users/' + userId + '/role', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cambiar rol');
    return data;
  }

  // ---- Categories ----
  function getCategories() {
    return ['Ficción', 'Ciencia', 'Historia', 'Educación', 'Tecnología', 'Arte', 'Filosofía'];
  }

  // ---- Supabase Auth ----
  async function supabaseLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function supabaseRegister(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function supabaseLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async function supabaseGetUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    return user;
  }

  // ---- Supabase Storage ----
  async function uploadBookFile(file) {
    const filePath = `libros/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('documentos')
      .upload(filePath, file);
    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  }

  return {
    registerUser,
    loginUser,
    logoutUser,
    getSession,
    searchBooks,
    searchBooksPaginated,
    getBookById,
    addBook,
    deleteBook,
    updateBook,
    incrementDownload,
    toggleFavorite,
    getUserFavorites,
    getUserHistory,
    getMostDownloaded,
    getRecentBooks,
    getUserProfile,
    updateUserProfile,
    getStats,
    getCategories,
    rateBook,
    getBookRating,
    getBookComments,
    addBookComment,
    deleteBookComment,
    trackView,
    getAdminStats,
    getAdminUsers,
    getAdminBooks,
    adminDeleteUser,
    adminDeleteBook,
    adminSetUserRole,
    // Supabase helpers
    supabaseLogin,
    supabaseRegister,
    supabaseLogout,
    supabaseGetUser,
    uploadBookFile,
  };
})();
