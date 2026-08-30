/* ============================================
   Store — API client (talks to Express backend)
   ============================================ */

// Configuración de Supabase
const SUPABASE_URL = 'https://nhjmpulzxfpezlseqrtj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oam1wdWx6eGZwZXpsc2VxcnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MjE4NDEsImV4cCI6MjEwMzI5Nzg0MX0.9oV9ASM1kaI2k8VZH5tdELDM-QP2HJN215nTth4u06c';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Store = (() => {
  const API = '/api';
  const supabase = supabaseClient; // acceso interno al cliente Supabase

  // ---- Generic fetch helper ----
  const FETCH_TIMEOUT = 15000; // 15 seconds (default)
  const UPLOAD_TIMEOUT = 300000; // 5 minutes for large file uploads (up to 200 MB)

  function _fetchWithTimeout(url, options = {}) {
    const timeout = options._timeout || FETCH_TIMEOUT;
    const { _timeout, ...fetchOpts } = options; // strip custom key before passing to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...fetchOpts, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  }

  async function _parseResponse(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      const snippet = text ? text.substring(0, 200) : '(empty)';
      console.error('Server non-JSON response:', res.status, snippet);
      throw new Error(
        `Error del servidor (HTTP ${res.status}): respuesta no válida — ${snippet}`
      );
    }
  }

  async function _get(url) {
    const res = await _fetchWithTimeout(API + url, { credentials: 'include' });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data;
  }

  async function _post(url, body) {
    const res = await _fetchWithTimeout(API + url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await _parseResponse(res);
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
    const res = await _fetchWithTimeout(API + '/books', {
      method: 'POST',
      credentials: 'include',
      body: formData, // FormData — browser sets Content-Type with boundary
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al subir');
    return data;
  }

  async function addBookJSON(bookData) {
    const res = await _fetchWithTimeout(API + '/books', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData),
    });
    const data = await _parseResponse(res);
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
    const res = await _fetchWithTimeout(API + '/users/' + id, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al actualizar perfil');
    return data;
  }

  async function getStats() {
    return _get('/users/stats');
  }

  // ---- Book CRUD ----
  async function deleteBook(bookId) {
    const res = await _fetchWithTimeout(API + '/books/' + bookId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');
    return data;
  }

  async function updateBook(bookId, updates) {
    const res = await _fetchWithTimeout(API + '/books/' + bookId, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al actualizar');
    return data;
  }

  // ---- Ratings ----
  async function rateBook(bookId, score) {
    const res = await _fetchWithTimeout(API + '/books/' + bookId + '/rate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    const data = await _parseResponse(res);
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
    const res = await _fetchWithTimeout(API + '/books/' + bookId + '/comments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al comentar');
    return data;
  }

  async function deleteBookComment(bookId, commentId) {
    const res = await _fetchWithTimeout(API + '/books/' + bookId + '/comments/' + commentId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await _parseResponse(res);
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
    const res = await _fetchWithTimeout(API + '/admin/users/' + userId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');
    return data;
  }

  async function adminDeleteBook(bookId) {
    const res = await _fetchWithTimeout(API + '/admin/books/' + bookId, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al eliminar libro');
    return data;
  }

  async function adminSetUserRole(userId, role) {
    const res = await _fetchWithTimeout(API + '/admin/users/' + userId + '/role', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await _parseResponse(res);
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

  // ---- Cover Auto-generation ----
  async function searchCovers(title, author) {
    const params = new URLSearchParams({ title });
    if (author) params.set('author', author);
    const data = await _get('/books/auto-cover-search?' + params.toString());
    return data.covers || [];
  }

  async function autoGenerateCover(bookId) {
    const res = await _fetchWithTimeout(API + '/books/' + bookId + '/auto-cover', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al generar portada');
    return data;
  }

  async function batchAutoCover(bookIds) {
    const res = await _fetchWithTimeout(API + '/books/auto-cover', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_ids: bookIds || [] }),
    });
    const data = await _parseResponse(res);
    if (!res.ok) throw new Error(data.error || 'Error al generar portadas');
    return data;
  }

  // ---- Supabase Storage ----
  // Upload with XHR for real progress tracking (Supabase JS client doesn't support upload progress)
  function _uploadToSupabaseXHR(filePath, file, contentType) {
    return new Promise((resolve, reject) => {
      const url = `${SUPABASE_URL}/storage/v1/object/documentos/${encodeURIComponent(filePath)}`;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
      xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'false');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          // Dispatch custom event so the UI can update progress
          window.dispatchEvent(new CustomEvent('upload-progress', { detail: { pct } }));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            resolve({ Key: filePath });
          }
        } else {
          let errorMsg = 'Error al subir el archivo a Supabase.';
          try {
            const errData = JSON.parse(xhr.responseText);
            errorMsg = errData.message || errData.error || errorMsg;
          } catch { /* use default */ }
          if (xhr.status === 413) {
            errorMsg = 'El archivo supera el límite del bucket en Supabase. Verifica el file_size_limit en el Dashboard.';
          }
          reject({ status: xhr.status, message: errorMsg });
        }
      };

      xhr.onerror = () => {
        reject({ status: 0, message: 'Error de red al conectar con Supabase. Verifica tu conexión a internet.' });
      };

      // 30 min timeout for very large files
      xhr.timeout = 30 * 60 * 1000;
      xhr.ontimeout = () => {
        reject({ status: 0, message: 'La subida tardó demasiado (>30 min). Intenta con un archivo más pequeño o verifica tu velocidad de subida.' });
      };

      xhr.send(file);
    });
  }

  async function uploadBookFile(file, onProgress) {
    // Upload directly from browser to Supabase Storage (avoids Vercel serverless timeout)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `libros/${Date.now()}_${safeName}`;
    const contentType = file.type || 'application/octet-stream';
    console.log('📤 Uploading directly to Supabase:', filePath, `(${(file.size / (1024 * 1024)).toFixed(1)} MB)`);

    // Listen for real progress events from XHR
    let progressHandler;
    if (onProgress) {
      progressHandler = (e) => onProgress(e.detail.pct);
      window.addEventListener('upload-progress', progressHandler);
    }

    try {
      await _uploadToSupabaseXHR(filePath, file, contentType);
    } catch (err) {
      console.error('❌ Supabase upload error:', err.message || err, err);
      let detail = err.message || 'Error desconocido al subir archivo.';
      if (err.status === 413 || (detail && detail.includes('maximum'))) {
        detail += '\n💡 Ejecuta el SQL de actualización del bucket en Supabase Dashboard → SQL Editor.';
      }
      throw new Error(detail);
    } finally {
      if (progressHandler) {
        window.removeEventListener('upload-progress', progressHandler);
      }
    }

    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(filePath);
    console.log('✅ File uploaded:', urlData.publicUrl);

    // Try to extract cover from PDF/EPUB in the browser
    let coverUrl = '';
    if (file.type === 'application/pdf' && typeof pdfjsLib !== 'undefined') {
      try {
        coverUrl = await _extractPDFFirstPage(file);
      } catch (e) { console.warn('⚠️ PDF cover extraction failed:', e.message); }
    }

    return { file_url: urlData.publicUrl, cover_url: coverUrl };
  }

  // Extract first page of a PDF as a PNG blob (browser-side)
  async function _extractPDFFirstPage(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        try {
          const coverFilename = `cover-pdf-${Date.now()}.png`;
          const coverUrl = await uploadCoverBlob(blob, coverFilename);
          resolve(coverUrl);
        } catch (e) { reject(e); }
      }, 'image/png');
    });
  }

  // Upload an image blob (e.g. extracted PDF cover) directly to Supabase Storage
  async function uploadCoverBlob(blob, filename) {
    const filePath = `portadas/${filename}`;
    const { error } = await supabase
      .storage
      .from('documentos')
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true,
      });
    if (error) throw new Error('Error al subir portada: ' + error.message);
    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(filePath);
    return urlData.publicUrl;
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
    addBookJSON,
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
    // Cover helpers
    searchCovers,
    autoGenerateCover,
    batchAutoCover,
    // Supabase helpers
    supabaseLogin,
    supabaseRegister,
    supabaseLogout,
    supabaseGetUser,
    uploadBookFile,
    uploadCoverBlob,
  };
})();
