/* ============================================
   Components — Reusable UI rendering functions
   Updated with new features: favorites, most downloaded,
   categories page, about page, pagination, reading history
   ============================================ */

const Components = (() => {

  // ---- Helpers ----
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Escape a string for safe use inside HTML attribute onclick="..."
   *  1) JS-escape: backslash, single-quote, newlines
   *  2) HTML-entity-encode: double-quote, ampersand, angle brackets
   */
  function escapeAttr(str) {
    if (str == null) return '';
    return String(str)
      .replace(/\\/g, '\\\\')   // backslash → \\
      .replace(/'/g, "\\'")      // single-quote → \\'
      .replace(/"/g, '&quot;')     // double-quote → &quot;
      .replace(/&/g, '&amp;')       // ampersand → &amp;
      .replace(/</g, '&lt;')        // < → &lt;
      .replace(/>/g, '&gt;')        // > → &gt;
      .replace(/\n/g, '\\n')      // newline → \\n
      .replace(/\r/g, '\\r');     // CR → \\r
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} ${hours}:${mins}`;
  }

  function getFileIcon(type) {
    const icons = { PDF: '📕', EPUB: '📗', MOBI: '📘', DOC: '📄', DOCX: '📄' };
    return icons[(type || '').toUpperCase()] || '📖';
  }

  function getCategoryIcon(cat) {
    const icons = {
      'Ficción': '📚', 'Ciencia': '🔬', 'Historia': '🏛️', 'Educación': '🎓',
      'Tecnología': '💻', 'Arte': '🎨', 'Filosofía': '🧠',
    };
    return icons[cat] || '📖';
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function getCoverGradient(id) {
    const gradients = [
      'linear-gradient(135deg, #6d4c41, #8d6e63)',
      'linear-gradient(135deg, #4e342e, #795548)',
      'linear-gradient(135deg, #3e2723, #6d4c41)',
      'linear-gradient(135deg, #5d4037, #a1887f)',
      'linear-gradient(135deg, #455a64, #78909c)',
      'linear-gradient(135deg, #00695c, #4db6ac)',
      'linear-gradient(135deg, #e65100, #ffb74d)',
      'linear-gradient(135deg, #283593, #7986cb)',
    ];
    const numId = typeof id === 'number' ? id : (id ? String(id).charCodeAt(0) : 0);
    return gradients[numId % gradients.length];
  }

  // ---- Toast ----
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ---- Skeleton Components ----
  function renderSkeletonBooks(count = 6) {
    return Array.from({ length: count }, () => `
      <div class="skeleton-book-card">
        <div class="skeleton-book-cover skeleton"></div>
        <div class="skeleton-book-body">
          <div class="skeleton skeleton-text-lg"></div>
          <div class="skeleton skeleton-text-sm"></div>
          <div class="skeleton-book-meta">
            <div class="skeleton skeleton-chip"></div>
            <div class="skeleton skeleton-chip" style="width:50px;"></div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderSkeletonHero() {
    return `
      <div class="hero" style="padding:4rem 0;">
        <div class="container">
          <div class="skeleton" style="height:36px;width:50%;margin:0 auto 1rem;background:rgba(255,255,255,0.15);"></div>
          <div class="skeleton" style="height:18px;width:70%;margin:0 auto 0.5rem;background:rgba(255,255,255,0.1);"></div>
          <div class="skeleton" style="height:18px;width:50%;margin:0 auto 2rem;background:rgba(255,255,255,0.1);"></div>
          <div style="display:flex;gap:1rem;justify-content:center;">
            <div class="skeleton" style="height:44px;width:160px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.12);"></div>
            <div class="skeleton" style="height:44px;width:160px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.08);"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSkeletonSearchBar() {
    return `
      <section class="search-bar">
        <div class="container">
          <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <div class="skeleton" style="flex:1;min-width:250px;height:44px;border-radius:var(--radius-md);"></div>
            <div class="skeleton" style="width:160px;height:44px;border-radius:var(--radius-md);"></div>
            <div class="skeleton" style="width:100px;height:44px;border-radius:var(--radius-sm);"></div>
          </div>
        </div>
      </section>
    `;
  }

  function renderSkeletonCategoryChips() {
    const chips = Array.from({ length: 7 }, () => `
      <div class="skeleton skeleton-chip"></div>
    `).join('');
    return `<div class="categories-bar container">${chips}</div>`;
  }

  function renderSkeletonDetailPage() {
    return `
      <div class="detail-page container page-enter">
        <button class="btn btn-secondary btn-sm" style="margin-bottom:1.5rem;pointer-events:none;opacity:0.5;">← Volver al catálogo</button>
        <div class="skeleton-detail-layout">
          <div class="skeleton skeleton-detail-cover"></div>
          <div class="skeleton-detail-info">
            <div class="skeleton skeleton-text-lg" style="width:80%;"></div>
            <div class="skeleton skeleton-text-sm" style="width:40%;"></div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
              <div class="skeleton" style="height:24px;width:80px;border-radius:12px;"></div>
              <div class="skeleton" style="height:24px;width:70px;border-radius:12px;"></div>
              <div class="skeleton" style="height:24px;width:90px;border-radius:12px;"></div>
              <div class="skeleton" style="height:24px;width:100px;border-radius:12px;"></div>
            </div>
            <div class="skeleton" style="height:60px;width:100%;border-radius:var(--radius-md);"></div>
            <div class="skeleton" style="height:100px;width:100%;border-radius:var(--radius-md);"></div>
            <div style="display:flex;gap:0.75rem;">
              <div class="skeleton" style="height:44px;width:140px;border-radius:var(--radius-sm);"></div>
              <div class="skeleton" style="height:44px;width:140px;border-radius:var(--radius-sm);"></div>
              <div class="skeleton" style="height:44px;width:140px;border-radius:var(--radius-sm);"></div>
            </div>
          </div>
        </div>
        <div style="margin-top:2.5rem;padding-top:2rem;border-top:1px solid var(--color-border-light);">
          <div class="skeleton skeleton-text-lg" style="width:200px;margin-bottom:1.5rem;"></div>
          ${Array.from({ length: 3 }, () => `
            <div class="skeleton-comment">
              <div class="skeleton-comment-header">
                <div class="skeleton skeleton-circle" style="width:28px;height:28px;"></div>
                <div style="flex:1;">
                  <div class="skeleton skeleton-text-sm" style="width:120px;"></div>
                  <div class="skeleton" style="height:10px;width:80px;"></div>
                </div>
              </div>
              <div class="skeleton skeleton-text" style="width:90%;"></div>
              <div class="skeleton skeleton-text" style="width:60%;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderSkeletonProfilePage() {
    return `
      <div class="container page-enter" style="padding:2rem 0 3rem;">
        <div class="skeleton-profile-header">
          <div class="skeleton skeleton-circle" style="width:80px;height:80px;"></div>
          <div class="skeleton-profile-info">
            <div class="skeleton skeleton-text-lg" style="width:200px;"></div>
            <div style="display:flex;gap:1.5rem;">
              <div class="skeleton skeleton-text" style="width:100px;"></div>
              <div class="skeleton skeleton-text" style="width:100px;"></div>
              <div class="skeleton skeleton-text" style="width:120px;"></div>
            </div>
          </div>
        </div>
        <div class="skeleton skeleton-text-lg" style="width:250px;margin:1.5rem 0;"></div>
        ${renderSkeletonBooks(6)}
      </div>
    `;
  }

  function renderSkeletonCategoriesPage() {
    return `
      <div class="container page-enter" style="padding:2rem 0 3rem;">
        <div class="section-header">
          <div>
            <div class="skeleton skeleton-text-lg" style="width:200px;"></div>
            <div class="skeleton skeleton-text-sm" style="width:300px;margin-top:0.5rem;"></div>
          </div>
        </div>
        <div class="categories-grid">
          ${Array.from({ length: 7 }, () => `
            <div class="skeleton-category-card">
              <div class="skeleton skeleton-circle" style="width:48px;height:48px;margin:0 auto 0.75rem;"></div>
              <div class="skeleton skeleton-text" style="width:80px;margin:0 auto 0.3rem;"></div>
              <div class="skeleton" style="height:12px;width:100px;margin:0 auto;"></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderSkeletonAdminPage() {
    return `
      <div class="admin-page container page-enter">
        <div class="section-header">
          <div>
            <div class="skeleton skeleton-text-lg" style="width:300px;"></div>
            <div class="skeleton skeleton-text-sm" style="width:400px;margin-top:0.5rem;"></div>
          </div>
        </div>
        <div class="admin-tabs">
          <div class="skeleton" style="height:36px;width:120px;border-radius:var(--radius-sm);"></div>
          <div class="skeleton" style="height:36px;width:120px;border-radius:var(--radius-sm);"></div>
          <div class="skeleton" style="height:36px;width:120px;border-radius:var(--radius-sm);"></div>
        </div>
        <div class="admin-stats-grid">
          ${Array.from({ length: 6 }, () => `
            <div class="skeleton-stat-card">
              <div class="skeleton" style="width:40px;height:40px;border-radius:var(--radius-sm);"></div>
              <div style="flex:1;">
                <div class="skeleton skeleton-text-lg" style="width:50px;"></div>
                <div class="skeleton skeleton-text-sm" style="width:80px;"></div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="admin-dashboard-grid">
          <div class="skeleton-table">
            ${Array.from({ length: 5 }, () => `
              <div class="skeleton-table-row">
                <div class="skeleton skeleton-circle" style="width:28px;height:28px;flex:none;"></div>
                <div class="skeleton" style="flex:1;"></div>
                <div class="skeleton" style="flex:1;"></div>
              </div>
            `).join('')}
          </div>
          <div class="skeleton-table">
            ${Array.from({ length: 5 }, () => `
              <div class="skeleton-table-row">
                <div class="skeleton" style="flex:none;width:30px;height:20px;border-radius:4px;"></div>
                <div class="skeleton" style="flex:1;"></div>
                <div class="skeleton" style="flex:1;"></div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderSkeletonForm() {
    return `
      <div class="upload-section container page-enter">
        <div class="section-header">
          <div>
            <div class="skeleton skeleton-text-lg" style="width:250px;"></div>
            <div class="skeleton skeleton-text-sm" style="width:300px;margin-top:0.5rem;"></div>
          </div>
        </div>
        <div class="skeleton-form">
          ${Array.from({ length: 5 }, () => `
            <div class="skeleton-form-group">
              <div class="skeleton skeleton-text-sm" style="width:120px;margin-bottom:0.5rem;"></div>
              <div class="skeleton" style="height:44px;width:100%;"></div>
            </div>
          `).join('')}
          <div style="display:flex;gap:0.75rem;">
            <div class="skeleton" style="height:44px;width:180px;border-radius:var(--radius-sm);"></div>
            <div class="skeleton" style="height:44px;width:120px;border-radius:var(--radius-sm);"></div>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Navbar ----
  function renderNavbar(session) {
    const currentPath = Router.getCurrentRoute();

    const navLinks = session
      ? `
        <a href="#/" class="${currentPath === '/' ? 'active' : ''}">📚 Explorar</a>
        <a href="#/categories" class="${currentPath === '/categories' ? 'active' : ''}">📂 Categorías</a>
        <a href="#/upload" class="${currentPath === '/upload' ? 'active' : ''}">📤 Subir</a>
        <a href="#/profile/${session.id}" class="${currentPath.startsWith('/profile') ? 'active' : ''}">👤 Mi Estantería</a>
        ${session.role === 'admin' ? `<a href="#/admin" class="${currentPath === '/admin' ? 'active' : ''}">⚙️ Admin</a>` : ''}
        <a href="#/about" class="${currentPath === '/about' ? 'active' : ''}">ℹ️ Nosotros</a>
      `
      : `
        <a href="#/" class="${currentPath === '/' ? 'active' : ''}">📚 Explorar</a>
        <a href="#/categories" class="${currentPath === '/categories' ? 'active' : ''}">📂 Categorías</a>
        <a href="#/about" class="${currentPath === '/about' ? 'active' : ''}">ℹ️ Nosotros</a>
      `;

    const authActions = session
      ? `
        <div class="navbar-user" onclick="Router.navigate('/profile/${session.id}')">
          <div class="user-avatar">${getInitials(session.name)}</div>
          <span style="font-weight:500;font-size:0.9rem;">${escapeHtml(session.name.split(' ')[0])}</span>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="App.logout()">Salir</button>
      `
      : `
        <a href="#/login" class="btn btn-sm btn-secondary">Iniciar Sesión</a>
        <a href="#/register" class="btn btn-sm btn-primary">Registrarse</a>
      `;

    // Quick search bar in navbar
    const quickSearch = `
      <div class="navbar-search" id="navbar-search">
        <span class="navbar-search-icon">🔍</span>
        <input type="text" class="navbar-search-input" id="navbar-search-input"
          placeholder="Buscar libros..." onkeydown="if(event.key==='Enter')App.quickSearch()" />
      </div>
    `;

    // Dark mode toggle
    const darkToggle = `
      <button class="dark-toggle" onclick="App.toggleDarkMode()" title="Cambiar tema" id="dark-toggle-btn">
        🌙
      </button>
    `;

    return `
      <nav class="navbar">
        <div class="container navbar-inner">
          <div class="navbar-brand" onclick="Router.navigate('/')">
            <span class="brand-icon">📖</span>
            <span>Biblioteca Comunitaria</span>
          </div>
          <button class="mobile-toggle" onclick="App.toggleMobileMenu()" aria-label="Menu">☰</button>
          <ul class="navbar-nav" id="navbar-nav">
            ${navLinks}
          </ul>
          <div class="navbar-actions">
            ${quickSearch}
            ${darkToggle}
            ${authActions}
          </div>
        </div>
      </nav>
    `;
  }

  // ---- Hero Section ----
  function renderHero(stats) {
    return `
      <section class="hero">
        <div class="container">
          <h1>Tu Biblioteca Comunitaria Virtual</h1>
          <p>Comparte, descubre y disfruta de libros y documentos de la comunidad. 
             Ya somos <strong>${stats.totalUsers}</strong> lectores con <strong>${stats.totalBooks}</strong> documentos disponibles.</p>
          <div class="hero-actions">
            <a href="#/" class="btn btn-primary btn-lg">Explorar Catálogo</a>
            <a href="#/upload" class="btn btn-secondary btn-lg">Subir Documento</a>
          </div>
        </div>
      </section>
    `;
  }

  // ---- Book Card ----
  function renderBookCard(book, showFavorite = false, isFavorite = false) {
    const favBtn = showFavorite ? `
      <button class="book-card-fav ${isFavorite ? 'active' : ''}"
        onclick="event.stopPropagation();App.toggleFavoriteCard('${book.id}',this)"
        title="${isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
        ${isFavorite ? '❤️' : '🤍'}
      </button>
    ` : '';

    return `
      <div class="book-card" onclick="Router.navigate('/book/${book.id}')">
        <div class="book-card-cover" style="background:${getCoverGradient(book.id)}">
          <span class="file-badge">${escapeHtml(book.fileType || 'PDF')}</span>
          ${favBtn}
          ${getFileIcon(book.fileType)}
        </div>
        <div class="book-card-body">
          <div class="book-card-title">${escapeHtml(book.title)}</div>
          <div class="book-card-author">por ${escapeHtml(book.author)}</div>
          <div class="book-card-meta">
            <span class="book-card-category">${getCategoryIcon(book.category)} ${escapeHtml(book.category)}</span>
            <span class="book-card-date">${book.downloads || 0} ⬇️</span>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Most Downloaded Section ----
  function renderMostDownloaded(books) {
    if (!books || books.length === 0) return '';
    const cards = books.map(b => renderBookCard(b)).join('');
    return `
      <section class="container" style="padding:2rem 0 0;">
        <div class="section-header">
          <div>
            <h2 class="section-title">🏆 Más Descargados</h2>
            <p class="section-subtitle">Los documentos más populares de la comunidad</p>
          </div>
        </div>
        <div class="books-grid">${cards}</div>
      </section>
    `;
  }

  // ---- Search & Filters ----
  function renderSearchBar(activeCategory = '', activeQuery = '') {
    const categories = Store.getCategories();
    const options = categories.map(c =>
      `<option value="${c}" ${c === activeCategory ? 'selected' : ''}>${getCategoryIcon(c)} ${c}</option>`
    ).join('');

    return `
      <section class="search-bar">
        <div class="container">
          <div class="search-form">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" class="search-input" id="search-input"
                placeholder="Buscar por título, autor o etiqueta..."
                value="${escapeHtml(activeQuery)}" />
            </div>
            <select class="filter-select" id="category-filter">
              <option value="">Todas las categorías</option>
              ${options}
            </select>
            <button class="btn btn-primary" onclick="App.executeSearch()">Buscar</button>
          </div>
        </div>
      </section>
    `;
  }

  // ---- Category Chips ----
  function renderCategoryChips(activeCategory = '') {
    const categories = Store.getCategories();
    const chips = categories.map(c => `
      <button class="category-chip ${c === activeCategory ? 'active' : ''}"
        onclick="App.filterByCategory('${c}')">
        ${getCategoryIcon(c)} ${c}
      </button>
    `).join('');

    return `<div class="categories-bar container">${chips}</div>`;
  }

  // ---- Pagination ----
  function renderPagination(currentPage, totalPages, total) {
    if (totalPages <= 1) return '';
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

    const pageButtons = pages.map(p => `
      <button class="pagination-btn ${p === currentPage ? 'active' : ''}"
        onclick="App.goToPage(${p})">${p}</button>
    `).join('');

    return `
      <div class="pagination">
        <button class="pagination-btn" onclick="App.goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        ${pageButtons}
        <button class="pagination-btn" onclick="App.goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>
    `;
  }

  // ---- Book Grid ----
  function renderBookGrid(books) {
    if (!books || books.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <p class="empty-state-text">No se encontraron documentos.</p>
        </div>
      `;
    }
    const cards = books.map(b => renderBookCard(b)).join('');
    return `<div class="container"><div class="books-grid">${cards}</div></div>`;
  }

  // ---- Footer ----
  function renderFooter() {
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-links">
            <a href="#/">Inicio</a>
            <a href="#/categories">Categorías</a>
            <a href="#/upload">Subir Documento</a>
            <a href="#/about">Sobre Nosotros</a>
          </div>
          <p>© 2026 Biblioteca Comunitaria Virtual — Hecho con ❤️ para la comunidad lectora</p>
        </div>
      </footer>
    `;
  }

  // ---- Auth Form (Login / Register) ----
  function renderAuthForm(type) {
    const isLogin = type === 'login';
    const title = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
    const subtitle = isLogin
      ? 'Bienvenido de vuelta. Ingresa tus credenciales.'
      : 'Únete a nuestra comunidad de lectores.';
    const submitText = isLogin ? 'Entrar' : 'Crear Cuenta';
    const switchText = isLogin
      ? '¿No tienes cuenta? <a href="#/register">Regístrate aquí</a>'
      : '¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a>';

    const nameField = isLogin ? '' : `
      <div class="form-group">
        <label class="form-label">Nombre completo <span class="required">*</span></label>
        <input type="text" class="form-input" id="auth-name" placeholder="Tu nombre" required />
      </div>
    `;

    const emailValidation = isLogin ? '' : `
      <span class="email-validation" id="email-validation"></span>
    `;

    const passwordStrength = isLogin ? '' : `
      <div class="password-strength" id="password-strength">
        <div class="strength-bar">
          <div class="strength-fill" id="strength-fill"></div>
        </div>
        <span class="strength-label" id="strength-label"></span>
      </div>
      <div class="password-requirements" id="password-requirements">
        <div class="pw-req" id="pw-req-length"><span class="pw-req-icon">○</span> Mínimo 6 caracteres</div>
        <div class="pw-req" id="pw-req-upper"><span class="pw-req-icon">○</span> Una letra mayúscula</div>
        <div class="pw-req" id="pw-req-lower"><span class="pw-req-icon">○</span> Una letra minúscula</div>
        <div class="pw-req" id="pw-req-number"><span class="pw-req-icon">○</span> Un número</div>
      </div>
    `;

    return `
      <div class="auth-page">
        <div class="auth-card page-enter">
          <h2>📖 ${title}</h2>
          <p class="auth-subtitle">${subtitle}</p>
          <form id="auth-form" onsubmit="App.handleAuth(event, '${type}')">
            ${nameField}
            <div class="form-group">
              <label class="form-label">Correo electrónico <span class="required">*</span></label>
              <input type="email" class="form-input" id="auth-email" placeholder="tu@correo.com" required />
              ${emailValidation}
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña <span class="required">*</span></label>
              <input type="password" class="form-input" id="auth-password" placeholder="••••••••" required minlength="6" />
              ${passwordStrength}
            </div>
            <button type="submit" class="btn btn-primary btn-lg" style="width:100%;margin-top:0.5rem;">
              ${submitText}
            </button>
          </form>
          <p class="auth-switch">${switchText}</p>
        </div>
      </div>
    `;
  }

  // ---- Upload Form ----
  function renderUploadForm(session) {
    if (!session) {
      return `
        <div class="auth-page">
          <div class="auth-card page-enter">
            <div class="empty-state-icon">🔒</div>
            <h2 style="text-align:center;margin:1rem 0;">Acceso Requerido</h2>
            <p class="auth-subtitle">Debes iniciar sesión para subir documentos.</p>
            <div style="text-align:center;">
              <a href="#/login" class="btn btn-primary">Iniciar Sesión</a>
            </div>
          </div>
        </div>
      `;
    }

    const categories = Store.getCategories();
    const catOptions = categories.map(c => `<option value="${c}">${getCategoryIcon(c)} ${c}</option>`).join('');

    return `
      <div class="upload-section container page-enter">
        <div class="section-header">
          <div>
            <h1 class="section-title">📤 Subir Documento</h1>
            <p class="section-subtitle">Comparte un libro o documento con la comunidad</p>
          </div>
        </div>
        <form class="upload-form" id="upload-form" onsubmit="App.handleUpload(event)">
          <div class="form-group">
            <label class="form-label">Archivo <span class="required">*</span></label>
            <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
              <div class="drop-zone-icon">📁</div>
              <p class="drop-zone-text">Arrastra tu archivo aquí o <strong>haz clic para seleccionar</strong></p>
              <p class="drop-zone-formats">Formatos aceptados: PDF, EPUB, MOBI, DOC, DOCX (máx. 50 MB)</p>
            </div>
            <input type="file" id="file-input" accept=".pdf,.epub,.mobi,.doc,.docx" style="display:none" />
            <div id="file-preview"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Título <span class="required">*</span></label>
            <input type="text" class="form-input" id="book-title" placeholder="Título del documento" required />
          </div>
          <div class="form-group">
            <label class="form-label">Autor <span class="required">*</span></label>
            <input type="text" class="form-input" id="book-author" placeholder="Nombre del autor" required />
          </div>
          <div class="form-group">
            <label class="form-label">Categoría <span class="required">*</span></label>
            <select class="form-select" id="book-category" required>
              <option value="">Seleccionar categoría...</option>
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción <span class="required">*</span></label>
            <textarea class="form-textarea" id="book-description"
              placeholder="Describe el contenido del documento..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Etiquetas</label>
            <div class="tags-input-wrapper" id="tags-wrapper" onclick="document.getElementById('tags-input').focus()">
              <input type="text" class="tags-input" id="tags-input"
                placeholder="Escribe una etiqueta y presiona Enter..." />
            </div>
            <p class="form-hint">Presiona Enter para agregar cada etiqueta</p>
          </div>
          <button type="submit" class="btn btn-accent btn-lg" style="width:100%;">
            📤 Subir Documento
          </button>
        </form>
      </div>
    `;
  }

  // ---- Document Detail Page ----
  function renderDetailPage(book, isFavorite = false, favCount = 0, session = null) {
    const tagsHtml = (book.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`
    ).join('');

    const uploaderName = book.uploader_name || 'Desconocido';
    const ownerId = book.user_id || book.uploader_id;
    const isOwner = session && String(session.id) === String(ownerId);

    // Rating stars
    const rating = book.rating || { average: 0, count: 0, distribution: {} };
    const userRating = book.user_rating || 0;
    const starsHtml = _renderStars(rating.average, book.id, userRating, !!session, rating.count);

    // Owner actions
    let ownerActions = '';
    if (isOwner) {
      ownerActions = `
        <div class="detail-owner-actions">
          <a href="#/book/${book.id}/edit" class="btn btn-secondary btn-sm">✏️ Editar</a>
          <button class="btn btn-danger btn-sm" onclick="App.confirmDeleteBook('${book.id}', '${escapeAttr(book.title)}')">🗑️ Eliminar</button>
        </div>
      `;
    }

    // Favorite button
    const favBtn = `
      <button class="btn btn-lg ${isFavorite ? 'btn-fav-active' : 'btn-secondary'}"
        onclick="App.toggleFavoriteDetail('${book.id}')" id="detail-fav-btn">
        ${isFavorite ? '❤️' : '🤍'} ${isFavorite ? 'En Favoritos' : 'Favorito'}
        <span class="fav-count" id="detail-fav-count">${favCount || ''}</span>
      </button>
    `;

    // Share URL
    const shareBtn = `
      <button class="btn btn-secondary btn-lg" onclick="App.shareBook('${book.id}')">
        🔗 Compartir
      </button>
    `;

    return `
      <div class="detail-page container page-enter">
        <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/')" style="margin-bottom:1.5rem;">
          ← Volver al catálogo
        </button>
        <div class="detail-layout">
          <div class="detail-cover" style="background:${getCoverGradient(book.id)}">
            ${getFileIcon(book.fileType)}
          </div>
          <div class="detail-info">
            <h1>${escapeHtml(book.title)}</h1>
            <p class="detail-author">por <strong>${escapeHtml(book.author)}</strong></p>
            <div class="detail-meta">
              <span class="detail-meta-item">${getCategoryIcon(book.category)} ${escapeHtml(book.category)}</span>
              <span class="detail-meta-item">📄 ${escapeHtml(book.fileType || 'PDF')}</span>
              <span class="detail-meta-item">📅 ${formatDate(book.created_at || book.createdAt)}</span>
              <span class="detail-meta-item">⬇️ ${book.downloads || 0} descargas</span>
              <span class="detail-meta-item">⭐ ${rating.average ? rating.average.toFixed(1) : '0.0'} (${rating.count})</span>
              <span class="detail-meta-item">💬 ${book.comment_count || 0} comentarios</span>
            </div>
            ${starsHtml}
            <div class="detail-description">${escapeHtml(book.description)}</div>
            ${tagsHtml ? `<div class="detail-tags">${tagsHtml}</div>` : ''}
            <div class="detail-actions">
              ${book.file_url ? `
                <a href="/api/books/${book.id}/download" class="btn btn-primary btn-lg" onclick="event.preventDefault();App.downloadBook('${book.id}')">
                  ⬇️ Descargar
                </a>
              ` : ''}
              ${book.file_url ? `
                <button class="btn btn-accent btn-lg" onclick="App.viewBook('${book.file_url.replace(/'/g, "\\'")}')">
                  📖 Leer
                </button>
              ` : ''}
              ${favBtn}
              ${shareBtn}
            </div>
            ${ownerActions}
            <div class="detail-uploader">
              <div class="user-avatar">${getInitials(uploaderName)}</div>
              <div>
                <div class="detail-uploader-text">Subido por</div>
                <div class="detail-uploader-name" style="cursor:pointer;" onclick="Router.navigate('/profile/${ownerId}')">${escapeHtml(uploaderName)}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="detail-comments-section" id="comments-section">
          <h2 class="section-title">💬 Comentarios</h2>
          ${_renderCommentForm(session, book.id)}
          <div id="comments-list">
            ${Array.from({ length: 3 }, () => `
              <div class="skeleton-comment">
                <div class="skeleton-comment-header">
                  <div class="skeleton skeleton-circle" style="width:28px;height:28px;"></div>
                  <div style="flex:1;">
                    <div class="skeleton skeleton-text-sm" style="width:120px;"></div>
                    <div class="skeleton" style="height:10px;width:80px;"></div>
                  </div>
                </div>
                <div class="skeleton skeleton-text" style="width:90%;"></div>
                <div class="skeleton skeleton-text" style="width:60%;"></div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function _renderStars(average, bookId, userRating, isLoggedIn, ratingCount = 0) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const filled = i <= Math.round(average);
      stars.push(`<span class="star ${filled ? 'star-filled' : ''}">★</span>`);
    }

    let interactiveHtml = '';
    if (isLoggedIn) {
      interactiveHtml = `
        <div class="rating-interactive" id="rating-interactive">
          <span class="rating-label">Tu calificación:</span>
          <div class="rating-stars-input">
            ${[1,2,3,4,5].map(i => `<button class="rating-star-btn ${i <= userRating ? 'active' : ''}" onclick="App.rateBook('${bookId}', ${i})" title="${i} estrella${i>1?'s':''}">★</button>`).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="detail-rating">
        <div class="rating-display">
          <div class="rating-stars">${stars.join('')}</div>
          <span class="rating-text">${average ? average.toFixed(1) : '0.0'} de 5 · ${ratingCount} calificacion${ratingCount !== 1 ? 'es' : ''}</span>
        </div>
        ${interactiveHtml}
      </div>
    `;
  }

  function _renderCommentForm(session, bookId) {
    if (!session) {
      return `
        <div class="comment-form-disabled">
          <p><a href="#/login">Inicia sesión</a> para dejar un comentario.</p>
        </div>
      `;
    }
    return `
      <div class="comment-form" id="comment-form">
        <div class="comment-form-header">
          <div class="user-avatar user-avatar-sm">${getInitials(session.name)}</div>
          <span>${escapeHtml(session.name)}</span>
        </div>
        <textarea class="comment-textarea" id="comment-textarea" placeholder="Escribe tu comentario..." maxlength="1000"></textarea>
        <div class="comment-form-footer">
          <span class="comment-char-count" id="comment-char-count">0/1000</span>
          <button class="btn btn-primary btn-sm" onclick="App.addComment('${bookId}')">💬 Comentar</button>
        </div>
      </div>
    `;
  }

  function renderComments(comments, session, bookId) {
    if (!comments || comments.length === 0) {
      return `<div class="empty-state" style="padding:2rem 0;"><p class="empty-state-text">Aún no hay comentarios. ¡Sé el primero en comentar!</p></div>`;
    }
    return comments.map(c => {
      const isAuthor = session && String(session.id) === String(c.user_id);
      return `
        <div class="comment-item" id="comment-${c.id}">
          <div class="comment-header">
            <div class="user-avatar user-avatar-sm">${getInitials(c.user_name)}</div>
            <div class="comment-meta">
              <span class="comment-author">${escapeHtml(c.user_name)}</span>
              <span class="comment-date">${formatDateTime(c.created_at)}</span>
            </div>
            ${isAuthor ? `<button class="comment-delete" onclick="App.deleteComment('${bookId}', '${c.id}')" title="Eliminar comentario">🗑️</button>` : ''}
          </div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
      `;
    }).join('');
  }

  function renderCommentPagination(page, totalPages, total) {
    if (totalPages <= 1) return '';
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(`<button class="pagination-btn btn-sm ${i === page ? 'active' : ''}" onclick="App.goToCommentPage(${i})">${i}</button>`);
    }
    return `<div class="comment-pagination">${pages.join('')}</div>`;
  }

  // ---- Profile / User Shelf ----
  function renderProfilePage(data, session, favorites = [], history = []) {
    const { user, books, stats } = data;
    if (!user) {
      return `
        <div class="container page-enter" style="padding:4rem 0;text-align:center;">
          <div class="empty-state-icon">👤</div>
          <h2>Usuario no encontrado</h2>
          <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Volver al catálogo</a>
        </div>
      `;
    }

    const isOwn = session && String(session.id) === String(user.id);

    // Tabs for own profile
    let tabsHtml = '';
    let tabContentHtml = '';

    if (isOwn) {
      tabsHtml = `
        <div class="profile-tabs">
          <button class="profile-tab active" onclick="App.switchProfileTab('books',this)">📚 Mis Libros</button>
          <button class="profile-tab" onclick="App.switchProfileTab('favorites',this)">❤️ Favoritos</button>
          <button class="profile-tab" onclick="App.switchProfileTab('history',this)">🕐 Recientes</button>
        </div>
      `;

      const favCards = favorites.length > 0
        ? favorites.map(b => renderBookCard(b)).join('')
        : '<div class="empty-state"><div class="empty-state-icon">❤️</div><p class="empty-state-text">Aún no tienes favoritos.</p></div>';

      const historyCards = history.length > 0
        ? history.map(b => `
            <div class="history-item">
              <div class="book-card" onclick="Router.navigate('/book/${b.id}')">
                <div class="book-card-cover" style="background:${getCoverGradient(b.id)};height:120px;">
                  ${getFileIcon(b.fileType)}
                </div>
                <div class="book-card-body" style="padding:0.75rem;">
                  <div class="book-card-title" style="font-size:0.9rem;">${escapeHtml(b.title)}</div>
                  <div class="book-card-author" style="font-size:0.8rem;">por ${escapeHtml(b.author)}</div>
                  <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.3rem;">
                    🕐 ${formatDateTime(b.viewed_at)}
                  </div>
                </div>
              </div>
            </div>
          `).join('')
        : '<div class="empty-state"><div class="empty-state-icon">🕐</div><p class="empty-state-text">Aún no has visto ningún documento.</p></div>';

      tabContentHtml = `
        <div class="profile-tab-content" id="tab-books">
          ${renderBookGrid(books)}
        </div>
        <div class="profile-tab-content" id="tab-favorites" style="display:none;">
          <div class="container"><div class="books-grid">${favCards}</div></div>
        </div>
        <div class="profile-tab-content" id="tab-history" style="display:none;">
          <div class="container"><div class="history-grid">${historyCards}</div></div>
        </div>
      `;
    } else {
      tabContentHtml = renderBookGrid(books);
    }

    return `
      <div class="profile-page container page-enter">
        <div class="profile-header">
          <div class="user-avatar user-avatar-lg">${getInitials(user.name)}</div>
          <div class="profile-info">
            <h2>${escapeHtml(user.name)}</h2>
            <div class="profile-stats">
              <span class="profile-stat"><strong>${stats.bookCount}</strong> documentos</span>
              <span class="profile-stat"><strong>${stats.totalDownloads}</strong> descargas</span>
              <span class="profile-stat">Miembro desde <strong>${formatDate(user.createdAt)}</strong></span>
            </div>
          </div>
          ${isOwn ? `
            <div style="margin-left:auto;display:flex;gap:0.5rem;flex-wrap:wrap;">
              <a href="#/profile/${user.id}/edit" class="btn btn-secondary btn-sm">✏️ Editar Perfil</a>
              <a href="#/upload" class="btn btn-accent btn-sm">📤 Subir documento</a>
            </div>
          ` : ''}
        </div>
        ${tabsHtml}
        <div class="section-header">
          <div>
            <h1 class="section-title">${isOwn ? 'Mi Estantería' : `Estantería de ${escapeHtml(user.name.split(' ')[0])}`}</h1>
          </div>
        </div>
        ${tabContentHtml}
      </div>
    `;
  }

  // ---- Profile Edit Form ----
  function renderProfileEditForm(user, session) {
    if (!session) {
      return `
        <div class="auth-page">
          <div class="auth-card page-enter">
            <div class="empty-state-icon">🔒</div>
            <h2 style="text-align:center;margin:1rem 0;">Acceso Requerido</h2>
            <p class="auth-subtitle">Debes iniciar sesión para editar tu perfil.</p>
            <div style="text-align:center;">
              <a href="#/login" class="btn btn-primary">Iniciar Sesión</a>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="upload-section container page-enter">
        <div class="section-header">
          <div>
            <h1 class="section-title">✏️ Editar Perfil</h1>
            <p class="section-subtitle">Actualiza tu información personal</p>
          </div>
        </div>
        <div class="profile-edit-card">
          <div class="profile-edit-avatar">
            <div class="user-avatar user-avatar-lg">${getInitials(user.name)}</div>
            <p class="profile-edit-name-preview">${escapeHtml(user.name)}</p>
          </div>
          <form class="upload-form" id="profile-edit-form" onsubmit="App.handleProfileEdit(event, ${user.id})">
            <div class="form-group">
              <label class="form-label">Nombre completo <span class="required">*</span></label>
              <input type="text" class="form-input" id="profile-name" value="${escapeHtml(user.name)}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Correo electrónico <span class="required">*</span></label>
              <input type="email" class="form-input" id="profile-email" value="${escapeHtml(user.email)}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña actual</label>
              <input type="password" class="form-input" id="profile-current-password" placeholder="Requerida solo si cambias la contraseña" />
              <p class="form-hint">Solo es necesaria si deseas cambiar tu contraseña</p>
            </div>
            <div class="form-group">
              <label class="form-label">Nueva contraseña</label>
              <input type="password" class="form-input" id="profile-new-password" placeholder="Mínimo 6 caracteres" minlength="6" />
            </div>
            <div class="form-group">
              <label class="form-label">Confirmar nueva contraseña</label>
              <input type="password" class="form-input" id="profile-confirm-password" placeholder="Repite la nueva contraseña" minlength="6" />
            </div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
              <button type="submit" class="btn btn-accent btn-lg">💾 Guardar Cambios</button>
              <a href="#/profile/${user.id}" class="btn btn-secondary btn-lg">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // ---- Categories Page ----
  function renderCategoriesPage(categoriesData) {
    const cards = categoriesData.map(cat => `
      <div class="category-card" onclick="Router.navigate('/?category=${encodeURIComponent(cat.name)}')">
        <div class="category-card-icon">${cat.icon}</div>
        <h3 class="category-card-name">${escapeHtml(cat.name)}</h3>
        <p class="category-card-count">${cat.count} documento${cat.count !== 1 ? 's' : ''}</p>
      </div>
    `).join('');

    return `
      <div class="container page-enter" style="padding:2rem 0 3rem;">
        <div class="section-header">
          <div>
            <h1 class="section-title">📂 Categorías</h1>
            <p class="section-subtitle">Explora documentos por tema de interés</p>
          </div>
        </div>
        <div class="categories-grid">${cards}</div>
      </div>
    `;
  }

  // ---- Recently Added Section ----
  function renderRecentlyAdded(books) {
    if (!books || books.length === 0) return '';
    const cards = books.map(b => renderBookCard(b)).join('');
    return `
      <section class="container" style="padding:2rem 0 0;">
        <div class="section-header">
          <div>
            <h2 class="section-title">🆕 Agregados Recientemente</h2>
            <p class="section-subtitle">Los documentos más nuevos de la comunidad</p>
          </div>
        </div>
        <div class="books-grid">${cards}</div>
      </section>
    `;
  }

  // ---- Edit Book Form ----
  function renderEditBookForm(book, session) {
    if (!session) {
      return `
        <div class="auth-page">
          <div class="auth-card page-enter">
            <div class="empty-state-icon">🔒</div>
            <h2 style="text-align:center;margin:1rem 0;">Acceso Requerido</h2>
            <p class="auth-subtitle">Debes iniciar sesión para editar.</p>
            <div style="text-align:center;">
              <a href="#/login" class="btn btn-primary">Iniciar Sesión</a>
            </div>
          </div>
        </div>
      `;
    }

    const categories = Store.getCategories();
    const catOptions = categories.map(c =>
      `<option value="${c}" ${c === book.category ? 'selected' : ''}>${getCategoryIcon(c)} ${c}</option>`
    ).join('');

    return `
      <div class="upload-section container page-enter">
        <div class="section-header">
          <div>
            <h1 class="section-title">✏️ Editar Documento</h1>
            <p class="section-subtitle">Actualiza la información de tu documento</p>
          </div>
        </div>
        <form class="upload-form" onsubmit="App.handleEditBook(event, ${book.id})">
          <div class="form-group">
            <label class="form-label">Título <span class="required">*</span></label>
            <input type="text" class="form-input" id="edit-title" value="${escapeHtml(book.title)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Autor <span class="required">*</span></label>
            <input type="text" class="form-input" id="edit-author" value="${escapeHtml(book.author)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Categoría <span class="required">*</span></label>
            <select class="form-select" id="edit-category" required>
              <option value="">Seleccionar categoría...</option>
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Descripción <span class="required">*</span></label>
            <textarea class="form-textarea" id="edit-description" required>${escapeHtml(book.description)}</textarea>
          </div>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
            <button type="submit" class="btn btn-accent btn-lg">💾 Guardar Cambios</button>
            <a href="#/book/${book.id}" class="btn btn-secondary btn-lg">Cancelar</a>
          </div>
        </form>
      </div>
    `;
  }

  // ---- About Page ----
  function renderAboutPage(stats) {
    return `
      <div class="container page-enter" style="padding:2rem 0 3rem;">
        <div class="about-page">
          <div class="about-hero">
            <div class="about-icon">📖</div>
            <h1>Biblioteca Comunitaria Virtual</h1>
            <p class="about-tagline">Construyendo conocimiento juntos, un libro a la vez.</p>
          </div>

          <div class="about-content">
            <div class="about-section">
              <h2>🎯 Nuestra Misión</h2>
              <p>
                Creemos que el acceso al conocimiento es un derecho fundamental. Nuestra biblioteca comunitaria virtual 
                nació con la visión de crear un espacio donde cualquier persona pueda compartir y descubrir libros, 
                documentos y recursos educativos de forma gratuita y sencilla.
              </p>
            </div>

            <div class="about-stats-row">
              <div class="about-stat-card">
                <div class="about-stat-number">${stats.totalBooks}</div>
                <div class="about-stat-label">Documentos</div>
              </div>
              <div class="about-stat-card">
                <div class="about-stat-number">${stats.totalUsers}</div>
                <div class="about-stat-label">Lectores</div>
              </div>
              <div class="about-stat-card">
                <div class="about-stat-number">${stats.totalDownloads}</div>
                <div class="about-stat-label">Descargas</div>
              </div>
            </div>

            <div class="about-section">
              <h2>💡 ¿Cómo Funciona?</h2>
              <div class="about-steps">
                <div class="about-step">
                  <div class="about-step-icon">1️⃣</div>
                  <h3>Regístrate</h3>
                  <p>Crea tu cuenta gratuita en segundos y únete a nuestra comunidad de lectores.</p>
                </div>
                <div class="about-step">
                  <div class="about-step-icon">2️⃣</div>
                  <h3>Explora</h3>
                  <p>Descubre cientos de documentos organizados por categorías, autores y etiquetas.</p>
                </div>
                <div class="about-step">
                  <div class="about-step-icon">3️⃣</div>
                  <h3>Comparte</h3>
                  <p>Sube tus propios documentos y comparte el conocimiento con otros lectores.</p>
                </div>
              </div>
            </div>

            <div class="about-section">
              <h2>🤝 Nuestros Valores</h2>
              <div class="about-values">
                <div class="about-value">
                  <span class="about-value-icon">🌍</span>
                  <h3>Accesibilidad</h3>
                  <p>El conocimiento no debería tener barreras. Todos son bienvenidos.</p>
                </div>
                <div class="about-value">
                  <span class="about-value-icon">📚</span>
                  <h3>Comunidad</h3>
                  <p>Construimos juntos un repositorio vivo de conocimiento compartido.</p>
                </div>
                <div class="about-value">
                  <span class="about-value-icon">🔒</span>
                  <h3>Privacidad</h3>
                  <p>Tus datos están seguros. Respetamos tu privacidad y tu información.</p>
                </div>
                <div class="about-value">
                  <span class="about-value-icon">💡</span>
                  <h3>Educación</h3>
                  <p>Promovemos el aprendizaje continuo y la curiosidad intelectual.</p>
                </div>
              </div>
            </div>

            <div class="about-section about-cta">
              <h2>¡Únete a la Comunidad!</h2>
              <p>¿Listo para explorar o compartir tu primer documento?</p>
              <div class="about-cta-buttons">
                <a href="#/" class="btn btn-primary btn-lg">Explorar Catálogo</a>
                <a href="#/register" class="btn btn-accent btn-lg">Crear Cuenta</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Admin Panel ----
  function renderAdminPage(session, stats, users, books, activeTab) {
    if (!session || session.role !== 'admin') {
      return `
        <div class="container page-enter" style="padding:4rem 0;text-align:center;">
          <div class="empty-state-icon">🔒</div>
          <h2>Acceso Denegado</h2>
          <p style="color:var(--color-text-muted);margin:1rem 0;">No tienes permisos de administrador.</p>
          <a href="#/" class="btn btn-primary">Volver al inicio</a>
        </div>
      `;
    }

    const tab = activeTab || 'dashboard';

    // Stat cards
    const statCards = `
      <div class="admin-stats-grid">
        <div class="admin-stat-card">
          <div class="admin-stat-icon">📚</div>
          <div class="admin-stat-info">
            <div class="admin-stat-number">${stats.totalBooks}</div>
            <div class="admin-stat-label">Documentos</div>
          </div>
          <div class="admin-stat-badge">+${stats.booksThisMonth} este mes</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">👥</div>
          <div class="admin-stat-info">
            <div class="admin-stat-number">${stats.totalUsers}</div>
            <div class="admin-stat-label">Usuarios</div>
          </div>
          <div class="admin-stat-badge">+${stats.usersThisMonth} este mes</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">⬇️</div>
          <div class="admin-stat-info">
            <div class="admin-stat-number">${stats.totalDownloads}</div>
            <div class="admin-stat-label">Descargas</div>
          </div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">💬</div>
          <div class="admin-stat-info">
            <div class="admin-stat-number">${stats.totalComments}</div>
            <div class="admin-stat-label">Comentarios</div>
          </div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">⭐</div>
          <div class="admin-stat-info">
            <div class="admin-stat-number">${stats.totalRatings}</div>
            <div class="admin-stat-label">Calificaciones</div>
          </div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-icon">❤️</div>
          <div class="admin-stat-info">
            <div class="admin-stat-number">${stats.totalFavorites}</div>
            <div class="admin-stat-label">Favoritos</div>
          </div>
        </div>
      </div>
    `;

    // Tabs
    const tabs = `
      <div class="admin-tabs">
        <button class="admin-tab ${tab === 'dashboard' ? 'active' : ''}" onclick="App.switchAdminTab('dashboard')">📊 Dashboard</button>
        <button class="admin-tab ${tab === 'users' ? 'active' : ''}" onclick="App.switchAdminTab('users')">👥 Usuarios</button>
        <button class="admin-tab ${tab === 'books' ? 'active' : ''}" onclick="App.switchAdminTab('books')">📚 Documentos</button>
      </div>
    `;

    // Users table
    const usersTable = `
      <div class="admin-tab-content" id="admin-tab-users" style="display:${tab === 'users' ? 'block' : 'none'};">
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Libros</th>
                <th>Descargas</th>
                <th>Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${u.id}</td>
                  <td>
                    <div class="admin-user-cell">
                      <div class="user-avatar user-avatar-sm">${getInitials(u.name)}</div>
                      <span>${escapeHtml(u.name)}</span>
                    </div>
                  </td>
                  <td>${escapeHtml(u.email)}</td>
                  <td>
                    <span class="admin-role-badge ${u.role === 'admin' ? 'admin-role-admin' : 'admin-role-user'}">
                      ${u.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </span>
                  </td>
                  <td>${u.bookCount}</td>
                  <td>${u.totalDownloads}</td>
                  <td>${formatDate(u.created_at)}</td>
                  <td>
                    <div class="admin-actions">
                      ${u.id !== session.id ? `
                        <button class="btn btn-sm btn-secondary" onclick="App.adminToggleRole('${u.id}', '${u.role}')">
                          ${u.role === 'admin' ? '⬇️ Quitar Admin' : '⬆️ Hacer Admin'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="App.adminConfirmDeleteUser('${u.id}', '${escapeAttr(u.name)}')">
                          🗑️
                        </button>
                      ` : '<span class="text-muted">Tú</span>'}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Books table
    const booksTable = `
      <div class="admin-tab-content" id="admin-tab-books" style="display:${tab === 'books' ? 'block' : 'none'};">
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Autor</th>
                <th>Categoría</th>
                <th>Subido por</th>
                <th>Descargas</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${books.map(b => `
                <tr>
                  <td>${b.id}</td>
                  <td>
                    <a href="#/book/${b.id}" class="admin-link">${escapeHtml(b.title)}</a>
                  </td>
                  <td>${escapeHtml(b.author)}</td>
                  <td><span class="admin-category-badge">${getCategoryIcon(b.category)} ${escapeHtml(b.category)}</span></td>
                  <td>${escapeHtml(b.uploader_name || 'N/A')}</td>
                  <td>${b.downloads || 0}</td>
                  <td>${formatDate(b.created_at)}</td>
                  <td>
                    <button class="btn btn-sm btn-danger" onclick="App.adminConfirmDeleteBook('${b.id}', '${escapeAttr(b.title)}')">
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Dashboard tab content
    const dashboardContent = `
      <div class="admin-tab-content" id="admin-tab-dashboard" style="display:${tab === 'dashboard' ? 'block' : 'none'};">
        ${statCards}
        <div class="admin-dashboard-grid">
          <div class="admin-dashboard-card">
            <h3>👥 Últimos Usuarios</h3>
            <div class="admin-list">
              ${users.slice(0, 5).map(u => `
                <div class="admin-list-item">
                  <div class="user-avatar user-avatar-sm">${getInitials(u.name)}</div>
                  <div>
                    <div class="admin-list-name">${escapeHtml(u.name)}</div>
                    <div class="admin-list-meta">${escapeHtml(u.email)}</div>
                  </div>
                  <span class="admin-role-badge ${u.role === 'admin' ? 'admin-role-admin' : 'admin-role-user'}" style="font-size:0.7rem;">
                    ${u.role === 'admin' ? '👑' : '👤'}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="admin-dashboard-card">
            <h3>📚 Últimos Documentos</h3>
            <div class="admin-list">
              ${books.slice(0, 5).map(b => `
                <div class="admin-list-item">
                  <span class="file-badge" style="font-size:0.8rem;">${escapeHtml(b.fileType || 'PDF')}</span>
                  <div>
                    <div class="admin-list-name">${escapeHtml(b.title)}</div>
                    <div class="admin-list-meta">${escapeHtml(b.author)} · ${b.downloads || 0} ⬇️</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    return `
      <div class="admin-page container page-enter">
        <div class="section-header">
          <div>
            <h1 class="section-title">⚙️ Panel de Administración</h1>
            <p class="section-subtitle">Gestiona usuarios, documentos y configuración del sistema</p>
          </div>
        </div>
        ${tabs}
        ${dashboardContent}
        ${usersTable}
        ${booksTable}
      </div>
    `;
  }

  return {
    escapeHtml,
    formatDate,
    formatDateTime,
    getFileIcon,
    getCategoryIcon,
    getInitials,
    showToast,
    renderNavbar,
    renderHero,
    renderBookCard,
    renderMostDownloaded,
    renderRecentlyAdded,
    renderSkeletonBooks,
    renderSkeletonHero,
    renderSkeletonSearchBar,
    renderSkeletonCategoryChips,
    renderSkeletonDetailPage,
    renderSkeletonProfilePage,
    renderSkeletonCategoriesPage,
    renderSkeletonAdminPage,
    renderSkeletonForm,
    renderSearchBar,
    renderCategoryChips,
    renderPagination,
    renderBookGrid,
    renderFooter,
    renderAuthForm,
    renderUploadForm,
    renderDetailPage,
    renderEditBookForm,
    renderProfileEditForm,
    renderComments,
    renderCommentPagination,
    renderProfilePage,
    renderCategoriesPage,
    renderAboutPage,
    renderAdminPage,
  };
})();
