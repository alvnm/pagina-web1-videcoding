/* ============================================
   Vercel Serverless Function — API only
   ============================================ */

let app;
try {
  app = require('../server/app-vercel');
} catch (err) {
  console.error('❌ Failed to load Express app:', err.message);
  console.error(err.stack);
}

module.exports = (req, res) => {
  if (!app) {
    return res.status(500).json({ error: 'Server failed to initialize.', detail: 'app_not_loaded' });
  }
  try {
    return app(req, res);
  } catch (err) {
    console.error('❌ Request error:', err.message);
    console.error(err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
};
