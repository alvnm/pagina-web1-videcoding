/* ============================================
   Vercel Serverless Function — API only
   ============================================ */

const app = require('../server/app-vercel');

module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (err) {
    console.error('❌ Serverless function error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
};
