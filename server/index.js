/* ============================================
   Server — Local development entry point
   ============================================ */

const app = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
  📖 Biblioteca Comunitaria Virtual
  ─────────────────────────────────
  ✅ Server running at http://localhost:${PORT}
  📂 API:     http://localhost:${PORT}/api
  🌐 App:     http://localhost:${PORT}
  ─────────────────────────────────
  `);
});
