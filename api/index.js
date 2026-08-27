/* ============================================
   Vercel Serverless Function — wraps Express app
   ============================================ */

const app = require('../server/app');

module.exports = (req, res) => app(req, res);
