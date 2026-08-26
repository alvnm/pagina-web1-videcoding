/* ============================================
   Router — hash-based SPA navigation
   ============================================ */

const Router = (() => {
  const routes = {};
  let notFoundHandler = null;

  function register(path, handler) {
    routes[path] = handler;
  }

  function setNotFound(handler) {
    notFoundHandler = handler;
  }

  function navigate(path) {
    window.location.hash = path;
  }

  function getCurrentRoute() {
    const hash = window.location.hash.slice(1) || '/';
    return hash;
  }

  function _matchRoute(path) {
    // Exact match first
    if (routes[path]) return { handler: routes[path], params: {} };

    // Parameterized routes: /book/:id, /profile/:id
    for (const route in routes) {
      const routeParts = route.split('/');
      const pathParts = path.split('/');

      if (routeParts.length !== pathParts.length) continue;

      const params = {};
      let match = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }

      if (match) return { handler: routes[route], params };
    }

    return null;
  }

  function _handleRoute() {
    const path = getCurrentRoute();
    const result = _matchRoute(path);

    if (result) {
      result.handler(result.params);
    } else if (notFoundHandler) {
      notFoundHandler();
    }
  }

  function init() {
    window.addEventListener('hashchange', _handleRoute);
    _handleRoute();
  }

  return { register, setNotFound, navigate, init, getCurrentRoute };
})();
