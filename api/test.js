/* ============================================
   Minimal test — does the function even run?
   ============================================ */

module.exports = (req, res) => {
  res.json({ ok: true, path: req.url, method: req.method });
};
