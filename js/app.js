/* ============================================
   App — Main application controller (async API)
   ============================================ */

const App = (() => {
  const $app = () => document.getElementById('app');

  // Cached session (loaded once on boot, refreshed on login/logout)
  let _session = null;

  // Internal state for search / filter
  let _currentQuery = '';
  let _currentCategory = '';
  let _currentPage = 1;

  // Flag: favorites changed since last profile load
  let _favoritesDirty = false;

  // ---- Session management ----
  async function _loadSession() {
    _session = await Store.getSession();
    return _session;
  }

  // ---- Page renderers (all async) ----
  function _renderPage(content) {
    $app().innerHTML =
      Components.renderNavbar(_session) +
      content +
      Components.renderDocumentViewer() +
      Components.renderFooter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function _loginPage() {
    _renderPage(Components.renderAuthForm('login'));
    _attachAuthListeners();
  }

  function _registerPage() {
    _renderPage(Components.renderAuthForm('register'));
    _attachAuthListeners();
  }

  function _uploadPage() {
    _renderPage(Components.renderUploadForm(_session));
    _attachUploadListeners();
  }

  let _commentPage = 1;
  let _detailBookId = null;

  async function _bookDetailPage(params) {
    _renderPage(Components.renderSkeletonDetailPage());
    _detailBookId = params.id;
    _commentPage = 1;

    try {
      const book = await Store.getBookById(params.id);
      if (!book) {
        _renderPage(`
          <div class="container page-enter" style="padding:4rem 0;text-align:center;">
            <div class="empty-state-icon">❌</div>
            <h2>Documento no encontrado</h2>
            <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Volver al catálogo</a>
          </div>
        `);
        return;
      }

      // Track view
      Store.trackView(book.id);

      // Check favorite status
      let isFavorite = false;
      const favCount = book.favorite_count || 0;
      try {
        if (_session) {
          const favs = await Store.getUserFavorites(_session.id);
          isFavorite = favs.some(f => String(f.id) === String(book.id));
        }
      } catch { /* ignore */ }

      _renderPage(Components.renderDetailPage(book, isFavorite, favCount, _session));

      // Load comments asynchronously
      _loadComments(book.id);

      // Attach comment textarea listener
      const textarea = document.getElementById('comment-textarea');
      const charCount = document.getElementById('comment-char-count');
      if (textarea && charCount) {
        textarea.addEventListener('input', () => {
          charCount.textContent = textarea.value.length + '/1000';
        });
      }
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function _loadComments(bookId) {
    const listEl = document.getElementById('comments-list');
    if (!listEl) return;

    try {
      const result = await Store.getBookComments(bookId || _detailBookId, _commentPage);
      listEl.innerHTML =
        Components.renderComments(result.comments, _session, bookId || _detailBookId) +
        Components.renderCommentPagination(result.page, result.totalPages, result.total);
    } catch (err) {
      listEl.innerHTML = '<p style="color:var(--color-text-muted);padding:1rem 0;">No se pudieron cargar los comentarios.</p>';
    }
  }

  function goToCommentPage(page) {
    _commentPage = page;
    _loadComments(_detailBookId);
  }

  async function addComment(bookId) {
    const textarea = document.getElementById('comment-textarea');
    if (!textarea) return;
    const text = textarea.value.trim();
    if (!text) {
      Components.showToast('Escribe un comentario antes de enviar.', 'error');
      return;
    }
    if (text.length > 1000) {
      Components.showToast('El comentario no puede exceder 1000 caracteres.', 'error');
      return;
    }

    try {
      await Store.addBookComment(bookId, text);
      textarea.value = '';
      document.getElementById('comment-char-count').textContent = '0/1000';
      Components.showToast('Comentario publicado ✅', 'success');
      _loadComments(bookId);
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function deleteComment(bookId, commentId) {
    if (!confirm('¿Eliminar este comentario?')) return;
    try {
      await Store.deleteBookComment(bookId, commentId);
      Components.showToast('Comentario eliminado.', 'info');
      _loadComments(bookId);
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function rateBook(bookId, starIndex) {
    if (!_session) {
      Components.showToast('Debes iniciar sesión para calificar.', 'error');
      return;
    }
    try {
      // Read current rating from the interactive container
      const container = document.getElementById('rating-stars-input');
      const currentRating = container ? parseFloat(container.dataset.current || '0') : 0;

      // Determine the new score: toggle between full and half
      const fullVal = starIndex;        // e.g. clicking star 4 → 4.0
      const halfVal = starIndex - 0.5;   // e.g. clicking star 4 again → 3.5

      let newScore;
      if (currentRating === fullVal) {
        newScore = halfVal;              // full → half
      } else if (currentRating === halfVal) {
        newScore = fullVal;              // half → full
      } else {
        newScore = fullVal;              // different star → set full
      }

      const result = await Store.rateBook(bookId, newScore);

      // Update interactive stars UI
      if (container) {
        container.dataset.current = String(newScore);
        const btns = container.querySelectorAll('.rating-star-btn');
        btns.forEach((btn, idx) => {
          const i = idx + 1;
          btn.classList.remove('active', 'half');
          if (i <= Math.floor(newScore)) {
            btn.classList.add('active');
          } else if (i === Math.ceil(newScore) && newScore % 1 !== 0) {
            btn.classList.add('half');
          }
        });
      }

      // Update current value label
      const valEl = document.getElementById('rating-current-value');
      if (valEl) valEl.textContent = newScore.toFixed(1);

      // Update average display
      const ratingText = document.querySelector('.rating-text');
      if (ratingText && result.rating) {
        ratingText.textContent = `${result.rating.average ? result.rating.average.toFixed(1) : '0.0'} de 5 · ${result.rating.count} calificacion${result.rating.count !== 1 ? 'es' : ''}`;
      }

      // Update display stars (average)
      _updateDisplayStars(result.rating ? result.rating.average : 0);

      Components.showToast(`Calificación: ${newScore.toFixed(1)} ⭐`, 'success');
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  function _updateDisplayStars(average) {
    const container = document.querySelector('.rating-stars');
    if (!container) return;
    const avgFloor = Math.floor(average);
    const hasHalf = (average % 1) >= 0.25 && (average % 1) < 0.75;
    const avgRoundUp = Math.ceil(average);
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= avgFloor) {
        html += '<span class="star star-filled">★</span>';
      } else if (i === avgRoundUp && hasHalf) {
        html += '<span class="star star-half"><span class="star-half-fill">★</span><span class="star-half-empty">★</span></span>';
      } else if (i <= avgRoundUp && !hasHalf && average > 0) {
        html += '<span class="star star-filled">★</span>';
      } else {
        html += '<span class="star">★</span>';
      }
    }
    container.innerHTML = html;
  }

  async function downloadBook(bookId) {
    try {
      Components.showToast('⬇️ Descargando...', 'info');

      // Fetch the file via server proxy (handles Supabase Storage redirect)
      const controller = new AbortController();
      const downloadTimeout = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch('/api/books/' + bookId + '/download', { signal: controller.signal });
      clearTimeout(downloadTimeout);
      if (!resp.ok) throw new Error('Error al descargar');

      // Check if response is a redirect (external URL)
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        // Server returned a redirect page — follow it
        const data = await resp.json();
        if (data.file_url) {
          window.location.href = data.file_url;
          return;
        }
      }

      // Blob download
      const blob = await resp.blob();
      const disposition = resp.headers.get('content-disposition');
      let filename = 'documento';
      if (disposition) {
        const match = disposition.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/i);
        if (match) filename = decodeURIComponent(match[1]);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      Components.showToast('Error al descargar: ' + err.message, 'error');
    }
  }

  let _currentViewerUrl = '';
  let _currentViewerTitle = '';
  let _currentViewerBookId = '';

  function viewBook(fileUrl, title, bookId) {
    if (!fileUrl) {
      Components.showToast('No hay archivo disponible para leer.', 'error');
      return;
    }
    _currentViewerUrl = fileUrl;
    _currentViewerTitle = title || 'Documento';
    _currentViewerBookId = bookId || '';

    const modal = document.getElementById('doc-viewer-modal');
    const titleEl = document.getElementById('doc-viewer-title');
    const bodyEl = document.getElementById('doc-viewer-body');
    const externalLink = document.getElementById('doc-viewer-open-external');

    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = _currentViewerTitle;
    if (externalLink) externalLink.href = fileUrl;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Determine file type from URL (strip query params first)
    const cleanUrl = fileUrl.split('?')[0];
    const ext = cleanUrl.split('.').pop().toLowerCase();
    const isPDF = ext === 'pdf' || fileUrl.toLowerCase().includes('.pdf');
    const isEPUB = ext === 'epub';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

    // Always use server proxy stream URL to avoid CORS and redirect issues
    const streamUrl = bookId ? '/api/books/' + bookId + '/stream' : fileUrl;

    // Show loading state
    bodyEl.innerHTML = `
      <div class="doc-viewer-loading">
        <div class="doc-viewer-spinner"></div>
        <p>Cargando documento...</p>
      </div>
    `;

    if (isPDF || ext === '' || !ext) {
      // Use iframe for PDF or unknown — the server proxy handles Content-Type
      bodyEl.innerHTML = `<iframe src="${streamUrl}" class="doc-viewer-iframe" title="Visor de documento"></iframe>`;
    } else if (isEPUB) {
      bodyEl.innerHTML = `
        <div class="doc-viewer-fallback">
          <div style="font-size:4rem;margin-bottom:1rem;">📗</div>
          <h3>Formato EPUB</h3>
          <p>Los archivos EPUB se abrirán en una nueva pestaña para mejor compatibilidad.</p>
          <a href="${streamUrl}" target="_blank" class="btn btn-primary" style="margin-top:1rem;">Abrir EPUB</a>
        </div>
      `;
    } else if (isImage) {
      bodyEl.innerHTML = `<img src="${streamUrl}" class="doc-viewer-image" alt="Documento" />`;
    } else {
      // Try iframe first for any other format
      bodyEl.innerHTML = `<iframe src="${streamUrl}" class="doc-viewer-iframe" title="Visor de documento"></iframe>`;
    }
  }

  function closeDocViewer() {
    const modal = document.getElementById('doc-viewer-modal');
    const bodyEl = document.getElementById('doc-viewer-body');
    if (modal) modal.style.display = 'none';
    if (bodyEl) bodyEl.innerHTML = '';
    document.body.style.overflow = '';
    _currentViewerUrl = '';
  }

  async function downloadFromViewer() {
    if (_currentViewerUrl) {
      await downloadBook(_currentViewerBookId);
    }
  }

  async function shareBook(bookId) {
    const url = window.location.origin + '/#/book/' + bookId;
    let title = 'Documento';
    try {
      const book = await Store.getBookById(bookId);
      if (book) title = book.title;
    } catch { /* use default */ }
    const text = `📖 ${title} — Biblioteca Comunitaria Virtual`;
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        Components.showToast('Link copiado al portapapeles 📋', 'success');
      }).catch(() => {
        Components.showToast(url, 'info');
      });
    } else {
      Components.showToast(url, 'info');
    }
  }

  async function confirmDeleteBook(bookId, title) {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${title}"?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await Store.deleteBook(bookId);
      Components.showToast(`"${title}" eliminado correctamente.`, 'success');
      Router.navigate('/');
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function _profilePage(params) {
    _renderPage(Components.renderSkeletonProfilePage());

    try {
      const data = await Store.getUserProfile(params.id);

      // Load extra data for own profile
      let favorites = [];
      let history = [];
      if (_session && String(_session.id) === String(params.id)) {
        try {
          [favorites, history] = await Promise.all([
            Store.getUserFavorites(params.id),
            Store.getUserHistory(params.id),
          ]);
          _favoritesDirty = false;
        } catch { /* ignore */ }
      }

      _renderPage(Components.renderProfilePage(data, _session, favorites, history));
    } catch (err) {
      _renderPage(`
        <div class="container page-enter" style="padding:4rem 0;text-align:center;">
          <div class="empty-state-icon">👤</div>
          <h2>Usuario no encontrado</h2>
          <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Volver al catálogo</a>
        </div>
      `);
    }
  }

  async function _categoriesPage() {
    _renderPage(Components.renderSkeletonCategoriesPage());

    try {
      // Get all books and compute category counts client-side
      const books = await Store.searchBooks();
      const cats = {};
      const icons = {
        'Ficción': '📚', 'Ciencia': '🔬', 'Historia': '🏛️', 'Educación': '🎓',
        'Tecnología': '💻', 'Arte': '🎨', 'Filosofía': '🧠',
      };
      for (const book of books) {
        cats[book.category] = (cats[book.category] || 0) + 1;
      }
      const categoriesData = Object.entries(cats).map(([name, count]) => ({
        name,
        count,
        icon: icons[name] || '📖',
      })).sort((a, b) => b.count - a.count);

      _renderPage(Components.renderCategoriesPage(categoriesData));
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function _aboutPage() {
    try {
      const stats = await Store.getStats();
      _renderPage(Components.renderAboutPage(stats));
    } catch {
      _renderPage(Components.renderAboutPage({ totalBooks: 0, totalUsers: 0, totalDownloads: 0 }));
    }
  }

  function _notFoundPage() {
    _renderPage(`
      <div class="container page-enter" style="padding:4rem 0;text-align:center;">
        <div class="empty-state-icon">🔍</div>
        <h2>Página no encontrada</h2>
        <p style="color:var(--color-text-muted);margin:1rem 0;">La página que buscas no existe.</p>
        <a href="#/" class="btn btn-primary">Volver al inicio</a>
      </div>
    `);
  }

  // ---- ADMIN PAGE ----
  let _adminTab = 'dashboard';

  async function _adminPage() {
    if (!_session || _session.role !== 'admin') {
      _renderPage(Components.renderAdminPage(_session, {}, [], [], 'dashboard'));
      return;
    }

    _renderPage(Components.renderSkeletonAdminPage());

    try {
      const [stats, users, books] = await Promise.all([
        Store.getAdminStats(),
        Store.getAdminUsers(),
        Store.getAdminBooks(),
      ]);
      _renderPage(Components.renderAdminPage(_session, stats, users, books, _adminTab));
    } catch (err) {
      Components.showToast(err.message, 'error');
      _renderPage(Components.renderAdminPage(_session, {}, [], [], 'dashboard'));
    }
  }

  function switchAdminTab(tabName) {
    _adminTab = tabName;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');

    // Find and activate the clicked tab button
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => {
      if (t.textContent.includes(tabName === 'dashboard' ? 'Dashboard' : tabName === 'users' ? 'Usuarios' : 'Documentos')) {
        t.classList.add('active');
      }
    });

    const target = document.getElementById('admin-tab-' + tabName);
    if (target) target.style.display = 'block';
  }

  async function adminConfirmDeleteUser(userId, userName) {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${userName}"?\n\nEsta acción eliminará todos sus libros, favoritos, comentarios y calificaciones.`)) return;

    try {
      await Store.adminDeleteUser(userId);
      Components.showToast(`Usuario "${userName}" eliminado correctamente.`, 'success');
      _adminPage(); // Refresh
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function adminConfirmDeleteBook(bookId, bookTitle) {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${bookTitle}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
      await Store.adminDeleteBook(bookId);
      Components.showToast(`"${bookTitle}" eliminado correctamente.`, 'success');
      _adminPage(); // Refresh
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function adminToggleRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? 'promover a administrador' : 'quitar rol de administrador';

    if (!confirm(`¿Deseas ${action} a este usuario?`)) return;

    try {
      await Store.adminSetUserRole(userId, newRole);
      Components.showToast(`Rol actualizado correctamente.`, 'success');
      _adminPage(); // Refresh
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  // ---- Event handlers ----
  async function handleAuth(e, type) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    // Client-side validation
    if (type === 'register') {
      const name = document.getElementById('auth-name').value.trim();
      if (!name) {
        Components.showToast('Por favor ingresa tu nombre.', 'error');
        return;
      }
      if (!email) {
        Components.showToast('Por favor ingresa tu correo electrónico.', 'error');
        return;
      }
      if (!_isValidEmail(email)) {
        Components.showToast('El correo electrónico no tiene un formato válido.', 'error');
        return;
      }
      if (password.length < 6) {
        Components.showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        return;
      }
      const strength = _getPasswordStrength(password);
      if (strength.score < 2) {
        Components.showToast('La contraseña es muy débil. Usa mayúsculas, minúsculas y números.', 'error');
        return;
      }
    }

    if (!email || !password) {
      Components.showToast('Por favor completa todos los campos.', 'error');
      return;
    }

    // Disable submit button to prevent double-click
    const submitBtn = document.querySelector('#auth-form button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = type === 'register' ? 'Creando cuenta...' : 'Entrando...';
    }

    try {
      if (type === 'register') {
        const name = document.getElementById('auth-name').value.trim();
        const { user } = await Store.registerUser({ name, email, password });
        _session = user;
        Components.showToast(`¡Bienvenido/a, ${user.name}!`, 'success');
      } else {
        const { user } = await Store.loginUser({ email, password });
        _session = user;
        Components.showToast(`¡Hola de nuevo, ${user.name.split(' ')[0]}!`, 'success');
      }
      Router.navigate('/');
    } catch (err) {
      Components.showToast(err.message, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  // ---- Email Validation ----
  function _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function _validateEmail() {
    const input = document.getElementById('auth-email');
    const validation = document.getElementById('email-validation');
    if (!input || !validation) return;

    const email = input.value.trim();
    if (!email) {
      validation.textContent = '';
      validation.className = 'email-validation';
      input.classList.remove('email-input-valid', 'email-input-invalid');
      return;
    }

    if (_isValidEmail(email)) {
      validation.textContent = '✓ Formato válido';
      validation.className = 'email-validation email-valid';
      input.classList.remove('email-input-invalid');
      input.classList.add('email-input-valid');
    } else {
      validation.textContent = '✗ Ingresa un correo válido (ej: usuario@dominio.com)';
      validation.className = 'email-validation email-invalid';
      input.classList.remove('email-input-valid');
      input.classList.add('email-input-invalid');
    }
  }

  // ---- Password Strength ----
  function _getPasswordStrength(password) {
    let score = 0;
    const checks = {
      length: password.length >= 6,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    };

    if (checks.length) score++;
    if (checks.upper) score++;
    if (checks.lower) score++;
    if (checks.number) score++;

    let level, label;
    if (score <= 1) { level = 'weak'; label = 'Débil'; }
    else if (score === 2) { level = 'fair'; label = 'Regular'; }
    else if (score === 3) { level = 'good'; label = 'Buena'; }
    else { level = 'strong'; label = 'Fuerte'; }

    return { score, level, label, checks };
  }

  function _updatePasswordStrength() {
    const input = document.getElementById('auth-password');
    const fill = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    if (!input || !fill || !label) return;

    const password = input.value;
    if (!password) {
      fill.className = 'strength-fill';
      label.textContent = '';
      label.className = 'strength-label';
      _updateRequirements({});
      return;
    }

    const { level, label: labelText, checks } = _getPasswordStrength(password);
    fill.className = `strength-fill strength-${level}`;
    label.textContent = labelText;
    label.className = `strength-label strength-${level}`;
    _updateRequirements(checks);
  }

  function _updateRequirements(checks) {
    const reqs = [
      { id: 'pw-req-length', met: checks.length },
      { id: 'pw-req-upper', met: checks.upper },
      { id: 'pw-req-lower', met: checks.lower },
      { id: 'pw-req-number', met: checks.number },
    ];
    for (const req of reqs) {
      const el = document.getElementById(req.id);
      if (!el) continue;
      if (req.met) {
        el.classList.add('pw-req-met');
        el.querySelector('.pw-req-icon').textContent = '✓';
      } else {
        el.classList.remove('pw-req-met');
        el.querySelector('.pw-req-icon').textContent = '○';
      }
    }
  }

  function _attachAuthListeners() {
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    if (emailInput) {
      emailInput.addEventListener('input', _validateEmail);
    }
    if (passwordInput) {
      passwordInput.addEventListener('input', _updatePasswordStrength);
    }
  }

  async function logout() {
    const logoutBtn = document.querySelector('[onclick*="logout"]');
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Cerrando...';
    }
    try {
      await Store.logoutUser();
    } catch { /* server error, still clear local state */ }
    _session = null;
    Components.showToast('Sesión cerrada.', 'info');
    Router.navigate('/');
  }

  // Extract first page of a PDF as an image using PDF.js in the browser
  async function _extractCoverFromPDF(file) {
    if (!window.pdfjsLib) return '';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Convert canvas to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.9));
      if (!blob || blob.size < 100) return '';

      // Upload to Supabase Storage
      const filename = `cover-pdf-${Date.now()}-${Math.round(Math.random() * 1e4)}.png`;
      const url = await Store.uploadCoverBlob(blob, filename);
      console.log('✅ PDF cover extracted in browser:', url);
      return url;
    } catch (err) {
      console.error('⚠️ PDF cover extraction failed:', err.message);
      return '';
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    const category = document.getElementById('book-category').value;
    const description = document.getElementById('book-description').value.trim();

    if (!title || !author || !category || !description) {
      Components.showToast('Por favor completa todos los campos obligatorios.', 'error');
      return;
    }

    // Step 1: Upload file to Supabase Storage (if file selected)
    let fileUrl = '';
    const fileInput = document.getElementById('file-input');
    if (fileInput.files.length > 0) {
      try {
        Components.showToast('📤 Subiendo archivo...', 'info');
        const uploadResult = await Store.uploadBookFile(fileInput.files[0]);
        fileUrl = uploadResult.file_url || '';
      } catch (uploadErr) {
        console.error('File upload error:', uploadErr);
        Components.showToast('Error al subir el archivo: ' + (uploadErr.message || uploadErr.error?.message || 'Error desconocido'), 'error');
        return;
      }
    }

    // Step 1b: Extract cover from PDF using PDF.js in the browser
    let extractedCoverUrl = '';
    const selectedFile = fileInput.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf' && window.pdfjsLib) {
      try {
        Components.showToast('🖼️ Extrayendo portada del PDF...', 'info');
        extractedCoverUrl = await _extractCoverFromPDF(selectedFile);
        if (extractedCoverUrl) {
          Components.showToast('🖼️ Portada extraída del PDF ✅', 'success');
        }
      } catch (pdfErr) {
        console.error('PDF cover extraction error:', pdfErr);
      }
    }

    // Step 2: Upload cover image to Supabase Storage (if cover selected)
    let coverUrl = '';
    const coverInput = document.getElementById('cover-input');
    if (coverInput && coverInput.files.length > 0) {
      try {
        Components.showToast('🖼️ Subiendo portada...', 'info');
        const coverResult = await Store.uploadBookFile(coverInput.files[0]);
        coverUrl = coverResult.file_url || '';
      } catch (coverErr) {
        console.error('Cover upload error:', coverErr);
        Components.showToast('Error al subir la portada: ' + (coverErr.message || coverErr.error?.message || 'Error desconocido'), 'error');
      }
    }

    // Priority: manual cover > extracted PDF cover > Open Library > server fallback
    if (!coverUrl && extractedCoverUrl) {
      coverUrl = extractedCoverUrl;
    }
    if (!coverUrl && _selectedCoverUrl) {
      coverUrl = _selectedCoverUrl;
      Components.showToast('🖼️ Usando portada de Open Library', 'info');
    }

    // Step 3: Create book record with file URL and cover URL
    // If no cover at all, the server will auto-generate (Open Library → Placeholder)
    try {
      Components.showToast('📚 Guardando documento...', 'info');
      const { book } = await Store.addBookJSON({
        title, author, category, description,
        tags: _currentTags,
        file_url: fileUrl,
        cover_url: coverUrl,
      });
      // Reset selected cover
      _selectedCoverUrl = '';
      Components.showToast('¡Documento subido exitosamente! 🎉', 'success');
      Router.navigate('/book/' + book.id);
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }



  // ---- Favorites ----
  async function toggleFavoriteCard(bookId, btnEl) {
    if (!_session) {
      Components.showToast('Debes iniciar sesión para agregar favoritos.', 'error');
      return;
    }
    try {
      const result = await Store.toggleFavorite(bookId);
      _favoritesDirty = true;

      // If unfavorited and the card is inside the favorites tab, remove it
      if (!result.isFavorite) {
        const card = btnEl.closest('.book-card');
        const favTab = btnEl.closest('#tab-favorites, .profile-tab-content');
        if (favTab && card) {
          card.style.transition = 'opacity 0.3s, transform 0.3s';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.9)';
          setTimeout(() => {
            card.remove();
            // Show empty state if no favorites left
            const grid = favTab.querySelector('.books-grid');
            if (grid && grid.children.length === 0) {
              grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❤️</div><p class="empty-state-text">Aún no tienes favoritos.</p></div>';
            }
          }, 300);
        } else {
          // Regular card (catalog) — just update icon
          btnEl.innerHTML = '🤍';
          btnEl.classList.remove('active');
        }
      } else {
        btnEl.innerHTML = '❤️';
        btnEl.classList.add('active');
      }

      Components.showToast(
        result.isFavorite ? 'Agregado a favoritos ❤️' : 'Removido de favoritos',
        'success'
      );
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function toggleFavoriteDetail(bookId) {
    if (!_session) {
      Components.showToast('Debes iniciar sesión para agregar favoritos.', 'error');
      return;
    }
    try {
      const result = await Store.toggleFavorite(bookId);
      const btn = document.getElementById('detail-fav-btn');
      const count = document.getElementById('detail-fav-count');
      if (btn) {
        btn.className = `btn btn-lg ${result.isFavorite ? 'btn-fav-active' : 'btn-secondary'}`;
        btn.innerHTML = `${result.isFavorite ? '❤️' : '🤍'} ${result.isFavorite ? 'En Favoritos' : 'Favorito'} <span class="fav-count" id="detail-fav-count">${result.count || ''}</span>`;
      }
      _favoritesDirty = true;
      Components.showToast(
        result.isFavorite ? 'Agregado a favoritos ❤️' : 'Removido de favoritos',
        'success'
      );
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  // ---- Search ----
  async function executeSearch() {
    const input = document.getElementById('search-input');
    const select = document.getElementById('category-filter');
    _currentQuery = input ? input.value : '';
    _currentCategory = select ? select.value : '';
    _currentPage = 1;
    await _homePage();
  }

  function quickSearch() {
    const input = document.getElementById('navbar-search-input');
    if (input && input.value.trim()) {
      _currentQuery = input.value.trim();
      _currentCategory = '';
      _currentPage = 1;
      Router.navigate('/');
      // Wait for page to render then trigger search
      setTimeout(() => executeSearch(), 100);
    }
  }

  async function filterByCategory(category) {
    _currentCategory = _currentCategory === category ? '' : category;
    _currentQuery = '';
    _currentPage = 1;
    await _homePage();
  }

  function goToPage(page) {
    if (page < 1) return;
    _currentPage = page;
    _homePage();
  }

  function _attachSearchListeners() {
    const input = document.getElementById('search-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeSearch();
      });
    }
  }

  // ---- Profile tabs ----
  async function switchProfileTab(tabName, btnEl) {
    // Update active tab button
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');

    // Show/hide tab content
    document.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById('tab-' + tabName);
    if (target) target.style.display = 'block';

    // Re-fetch favorites when opening the favorites tab
    if (tabName === 'favorites' && _session) {
      try {
        const favorites = await Store.getUserFavorites(_session.id);
        const grid = target ? target.querySelector('.books-grid') : null;
        if (grid) {
          if (favorites.length > 0) {
            grid.innerHTML = favorites.map(b => Components.renderBookCard(b, true, true)).join('');
          } else {
            grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❤️</div><p class="empty-state-text">Aún no tienes favoritos.</p></div>';
          }
        }
      } catch { /* ignore */ }
    }
  }

  // ---- Tags input ----
  let _currentTags = [];

  function _attachUploadListeners() {
    _currentTags = [];
    const tagsInput = document.getElementById('tags-input');
    const tagsWrapper = document.getElementById('tags-wrapper');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const coverDropZone = document.getElementById('cover-drop-zone');
    const coverInput = document.getElementById('cover-input');

    if (tagsInput) {
      tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = tagsInput.value.trim();
          if (val && !_currentTags.includes(val)) {
            _currentTags.push(val);
            _renderTags(tagsWrapper, tagsInput);
          }
          tagsInput.value = '';
        }
      });
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          _showFilePreview(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
          _showFilePreview(fileInput.files[0]);
        }
      });
    }

    // Cover image drag & drop and change
    if (coverDropZone && coverInput) {
      coverDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        coverDropZone.classList.add('dragover');
      });
      coverDropZone.addEventListener('dragleave', () => {
        coverDropZone.classList.remove('dragover');
      });
      coverDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        coverDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          coverInput.files = e.dataTransfer.files;
          _showCoverPreview(e.dataTransfer.files[0]);
        }
      });
      coverInput.addEventListener('change', () => {
        if (coverInput.files.length) {
          _showCoverPreview(coverInput.files[0]);
        }
      });
    }
  }

  function _renderTags(wrapper, input) {
    wrapper.querySelectorAll('.tag').forEach(t => t.remove());
    _currentTags.forEach((tag, i) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.innerHTML = `${Components.escapeHtml(tag)}
        <button class="tag-remove" type="button" onclick="App.removeTag(${i})">×</button>`;
      wrapper.insertBefore(tagEl, input);
    });
  }

  function removeTag(index) {
    _currentTags.splice(index, 1);
    const wrapper = document.getElementById('tags-wrapper');
    const input = document.getElementById('tags-input');
    if (wrapper && input) _renderTags(wrapper, input);
  }

  function _showFilePreview(file) {
    const preview = document.getElementById('file-preview');
    if (!preview || !file) return;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    preview.innerHTML = `
      <div class="file-preview">
        <span style="font-size:1.5rem;">${Components.getFileIcon(file.name.split('.').pop())}</span>
        <div>
          <div class="file-preview-name">${Components.escapeHtml(file.name)}</div>
          <div class="file-preview-size">${sizeMB} MB</div>
        </div>
        <button class="file-preview-remove" type="button" onclick="App.clearFile()">✕ Quitar</button>
      </div>
    `;
  }

  function _showCoverPreview(file) {
    const preview = document.getElementById('cover-preview');
    if (!preview || !file) return;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const url = URL.createObjectURL(file);
    preview.innerHTML = `
      <div class="cover-preview">
        <img src="${url}" alt="Vista previa de portada" class="cover-preview-img" />
        <div class="cover-preview-info">
          <div class="cover-preview-name">${Components.escapeHtml(file.name)}</div>
          <div class="cover-preview-size">${sizeMB} MB</div>
        </div>
        <button class="cover-preview-remove" type="button" onclick="App.clearCover()">✕ Quitar</button>
      </div>
    `;
  }

  function clearFile() {
    const fileInput = document.getElementById('file-input');
    const preview = document.getElementById('file-preview');
    if (fileInput) fileInput.value = '';
    if (preview) preview.innerHTML = '';
  }

  function clearCover() {
    const coverInput = document.getElementById('cover-input');
    const preview = document.getElementById('cover-preview');
    if (coverInput) coverInput.value = '';
    if (preview) preview.innerHTML = '';
  }

  // ---- Mobile menu ----
  function toggleMobileMenu() {
    const nav = document.getElementById('navbar-nav');
    if (nav) nav.classList.toggle('open');
  }

  // ---- Dark mode ----
  function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('biblioteca-dark-mode', isDark ? '1' : '0');
    const btn = document.getElementById('dark-toggle-btn');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
  }

  function _loadDarkMode() {
    const saved = localStorage.getItem('biblioteca-dark-mode');
    if (saved === '1') {
      document.body.classList.add('dark-mode');
      // Update toggle icon after navbar renders
      setTimeout(() => {
        const btn = document.getElementById('dark-toggle-btn');
        if (btn) btn.textContent = '☀️';
      }, 0);
    }
  }

  // ---- Init ----
  async function init() {
    // Load dark mode preference
    _loadDarkMode();

    // Load session first
    await _loadSession();

    // Register routes
    Router.register('/', _homePage);
    Router.register('/login', _loginPage);
    Router.register('/register', _registerPage);
    Router.register('/upload', _uploadPage);
    Router.register('/book/:id/edit', _editBookPage);
    Router.register('/book/:id', _bookDetailPage);
    Router.register('/profile/:id/edit', _profileEditPage);
    Router.register('/profile/:id', _profilePage);
    Router.register('/categories', _categoriesPage);
    Router.register('/about', _aboutPage);
    Router.register('/admin', _adminPage);
    Router.setNotFound(_notFoundPage);

    // Start
    Router.init();

    // Close document viewer on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('doc-viewer-modal');
        if (modal && modal.style.display !== 'none') {
          closeDocViewer();
        }
      }
    });
  }

  // ---- Edit Profile ----
  async function _profileEditPage(params) {
    if (!_session) {
      _renderPage(Components.renderAuthForm('login'));
      return;
    }

    if (String(_session.id) !== String(params.id)) {
      Components.showToast('No puedes editar el perfil de otro usuario.', 'error');
      Router.navigate('/profile/' + params.id);
      return;
    }

    _renderPage(Components.renderSkeletonForm());

    try {
      const data = await Store.getUserProfile(params.id);
      _renderPage(Components.renderProfileEditForm(data.user, _session));
    } catch (err) {
      Components.showToast(err.message, 'error');
      Router.navigate('/');
    }
  }

  async function handleProfileEdit(e, userId) {
    e.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const currentPassword = document.getElementById('profile-current-password').value;
    const newPassword = document.getElementById('profile-new-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;

    if (!name || !email) {
      Components.showToast('Nombre y correo son obligatorios.', 'error');
      return;
    }

    // Validate password change
    if (newPassword) {
      if (!currentPassword) {
        Components.showToast('Debes ingresar tu contraseña actual para cambiarla.', 'error');
        return;
      }
      if (newPassword.length < 6) {
        Components.showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        Components.showToast('Las contraseñas no coinciden.', 'error');
        return;
      }
    }

    const updates = { name, email };
    if (newPassword) {
      updates.password = newPassword;
      updates.current_password = currentPassword;
    }

    try {
      const result = await Store.updateUserProfile(userId, updates);
      // Update local session if name changed
      if (result && result.user) {
        _session = { ..._session, name: result.user.name, email: result.user.email };
      }
      Components.showToast('Perfil actualizado correctamente ✅', 'success');
      Router.navigate('/profile/' + userId);
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  // ---- Edit Book ----
  async function _editBookPage(params) {
    if (!_session) {
      _renderPage(Components.renderAuthForm('login'));
      return;
    }

    _renderPage(Components.renderSkeletonForm());

    try {
      const book = await Store.getBookById(params.id);
      if (!book) {
        Components.showToast('Documento no encontrado.', 'error');
        Router.navigate('/');
        return;
      }
      if (String(book.user_id) !== String(_session.id)) {
        Components.showToast('No tienes permiso para editar este documento.', 'error');
        Router.navigate('/book/' + params.id);
        return;
      }

      _renderPage(Components.renderEditBookForm(book, _session));
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  async function handleEditBook(e, bookId) {
    e.preventDefault();
    const title = document.getElementById('edit-title').value.trim();
    const author = document.getElementById('edit-author').value.trim();
    const category = document.getElementById('edit-category').value;
    const description = document.getElementById('edit-description').value.trim();

    if (!title || !author || !category || !description) {
      Components.showToast('Completa todos los campos obligatorios.', 'error');
      return;
    }

    // Handle cover image upload if selected
    let coverUrl = undefined;
    const coverInput = document.getElementById('cover-input');
    if (coverInput && coverInput.files.length > 0) {
      try {
        Components.showToast('🖼️ Subiendo nueva portada...', 'info');
        const result = await Store.uploadBookFile(coverInput.files[0]);
        coverUrl = result.file_url || result.cover_url || undefined;
      } catch (coverErr) {
        console.error('Cover upload error:', coverErr);
        Components.showToast('Error al subir la portada: ' + (coverErr.message || coverErr.error?.message || 'Error desconocido'), 'error');
        // Continue without updating cover
        coverUrl = undefined;
      }
    }

    try {
      const updates = { title, author, category, description };
      if (coverUrl !== undefined) {
        updates.cover_url = coverUrl;
      }
      await Store.updateBook(bookId, updates);
      Components.showToast('Documento actualizado ✅', 'success');
      Router.navigate('/book/' + bookId);
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  // ---- Recently Added Section ----
  async function _homePage() {
    // Check if category is in query string (from categories page)
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const catFromUrl = urlParams.get('category');
    if (catFromUrl && !_currentCategory) {
      _currentCategory = catFromUrl;
    }

    // Fetch stats for hero (only on initial catalog view)
    let heroHtml = '';
    if (!_currentQuery && !_currentCategory) {
      try {
        const stats = await Store.getStats();
        heroHtml = Components.renderHero(stats);
      } catch {
        heroHtml = Components.renderHero({ totalUsers: '?', totalBooks: '?' });
      }
    }

    // Fetch most downloaded (only on initial catalog view)
    let mostDownloadedHtml = '';
    if (!_currentQuery && !_currentCategory) {
      try {
        const mostBooks = await Store.getMostDownloaded(6);
        mostDownloadedHtml = Components.renderMostDownloaded(mostBooks);
      } catch { /* ignore */ }
    }

    // Fetch recently added (only on initial catalog view)
    let recentHtml = '';
    if (!_currentQuery && !_currentCategory) {
      try {
        const recentBooks = await Store.getRecentBooks(6);
        recentHtml = Components.renderRecentlyAdded(recentBooks);
      } catch { /* ignore */ }
    }

    _renderPage(
      heroHtml +
      Components.renderSearchBar(_currentCategory, _currentQuery) +
      Components.renderCategoryChips(_currentCategory) +
      `<div class="section-header container" style="padding-top:1rem;">
        <div>
          <h2 class="section-title">Catálogo</h2>
          <p class="section-subtitle"><span id="book-count">Cargando...</span></p>
        </div>
      </div>` +
      `<div class="container"><div class="books-grid" id="books-grid">
        ${Components.renderSkeletonBooks(6)}
      </div></div>` +
      `<div id="pagination-wrapper"></div>` +
      mostDownloadedHtml +
      recentHtml
    );
    _attachSearchListeners();

    try {
      const result = await Store.searchBooksPaginated({
        query: _currentQuery,
        category: _currentCategory,
        page: _currentPage,
        perPage: 12,
      });

      const countEl = document.getElementById('book-count');
      const gridEl = document.getElementById('books-grid');
      const pagEl = document.getElementById('pagination-wrapper');

      if (countEl) {
        countEl.textContent = `${result.total} documento${result.total !== 1 ? 's' : ''} encontrado${result.total !== 1 ? 's' : ''}`;
      }
      if (gridEl) {
        // Check favorites if logged in
        let favIds = [];
        if (_session) {
          try {
            const favs = await Store.getUserFavorites(_session.id);
            favIds = favs.map(f => f.id);
          } catch { /* ignore */ }
        }

        gridEl.innerHTML = result.books.length > 0
          ? result.books.map(b =>
              Components.renderBookCard(b, !!_session, favIds.some(f => String(f) === String(b.id)))
            ).join('')
          : `<div class="empty-state"><div class="empty-state-icon">📚</div>
              <p class="empty-state-text">No se encontraron documentos.</p>
              ${_session ? '<a href="#/upload" class="btn btn-primary">Subir el primero</a>' : ''}
            </div>`;
      }
      if (pagEl) {
        pagEl.innerHTML = Components.renderPagination(result.page, result.totalPages, result.total);
      }
    } catch (err) {
      Components.showToast(err.message, 'error');
    }
  }

  // ---- Cover Auto-generation ----
  async function searchCoverSuggestions() {
    const titleInput = document.getElementById('book-title');
    const authorInput = document.getElementById('book-author');
    const suggestionsEl = document.getElementById('cover-suggestions');
    const searchBtn = document.getElementById('search-cover-btn');

    const title = titleInput ? titleInput.value.trim() : '';
    const author = authorInput ? authorInput.value.trim() : '';

    if (!title) {
      Components.showToast('Ingresa el título primero para buscar portadas.', 'error');
      return;
    }

    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.textContent = '🔍 Buscando...';
    }
    if (suggestionsEl) {
      suggestionsEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--color-text-muted);">🔍 Buscando portadas en Open Library...</div>';
    }

    try {
      const covers = await Store.searchCovers(title, author);
      if (!suggestionsEl) return;

      if (covers.length === 0) {
        suggestionsEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--color-text-muted);">No se encontraron portadas. Se generará automáticamente al subir.</div>';
        return;
      }

      suggestionsEl.innerHTML = '<p style="font-size:0.85rem;color:var(--color-text-secondary);margin-bottom:0.5rem;">Haz clic en una portada para usarla:</p>' +
        '<div class="cover-suggestions-grid-inner">' +
        covers.map((c, i) => `
          <div class="cover-suggestion-item" onclick="App.selectCoverSuggestion('${escapeAttr(c.url)}', ${i})" title="${escapeAttr(c.title)} por ${escapeAttr(c.author)}${c.year ? ' (' + c.year + ')' : ''}">
            <img src="${escapeAttr(c.url)}" alt="Portada sugerida ${i + 1}" class="cover-suggestion-img" loading="lazy" />
            <div class="cover-suggestion-info">
              <div class="cover-suggestion-title">${escapeHtml(c.title)}</div>
              <div class="cover-suggestion-author">${escapeHtml(c.author)}${c.year ? ' · ' + c.year : ''}</div>
            </div>
          </div>
        `).join('') +
        '</div>';
    } catch (err) {
      if (suggestionsEl) {
        suggestionsEl.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--color-error);">Error al buscar portadas: ' + err.message + '</div>';
      }
    } finally {
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = '🔍 Buscar portada automáticamente';
      }
    }
  }

  function selectCoverSuggestion(url, index) {
    // Store the selected cover URL in a hidden input or global variable
    _selectedCoverUrl = url;

    // Update the cover preview
    const preview = document.getElementById('cover-preview');
    if (preview) {
      preview.innerHTML = `
        <div class="cover-preview">
          <img src="${escapeAttr(url)}" alt="Portada seleccionada" class="cover-preview-img" />
          <div class="cover-preview-info">
            <div class="cover-preview-name">Portada seleccionada de Open Library</div>
          </div>
          <button class="cover-preview-remove" type="button" onclick="App.clearCover()">✕ Quitar</button>
        </div>
      `;
    }

    // Highlight selected suggestion
    document.querySelectorAll('.cover-suggestion-item').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });

    Components.showToast('Portada seleccionada ✅', 'success');
  }

  // Global variable to store selected cover URL
  let _selectedCoverUrl = '';

  async function autoGenerateCover(bookId) {
    if (!confirm('¿Generar una portada automáticamente para este documento?')) return;

    try {
      Components.showToast('🖼️ Generando portada...', 'info');
      const result = await Store.autoGenerateCover(bookId);
      if (result && result.cover_url) {
        Components.showToast('✅ Portada generada correctamente', 'success');
        // Reload the page to show the new cover
        _bookDetailPage({ id: bookId });
      } else {
        Components.showToast('No se pudo generar la portada.', 'error');
      }
    } catch (err) {
      Components.showToast('Error al generar portada: ' + err.message, 'error');
    }
  }

  return {
    init,
    handleAuth,
    logout,
    handleUpload,
    executeSearch,
    quickSearch,
    filterByCategory,
    goToPage,
    toggleFavoriteCard,
    toggleFavoriteDetail,
    switchProfileTab,
    removeTag,
    clearFile,
    clearCover,
    toggleMobileMenu,
    toggleDarkMode,
    switchAdminTab,
    adminConfirmDeleteUser,
    adminConfirmDeleteBook,
    adminToggleRole,
    addComment,
    deleteComment,
    goToCommentPage,
    rateBook,
    downloadBook,
    viewBook,
    closeDocViewer,
    downloadFromViewer,
    shareBook,
    confirmDeleteBook,
    handleProfileEdit,
    handleEditBook,
    searchCoverSuggestions,
    selectCoverSuggestion,
    autoGenerateCover,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
