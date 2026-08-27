/* ============================================
   Server — Express application entry point
   ============================================ */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// Initialize database (JSON file + seed data)
require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  name: 'bcv.sid',
  secret: process.env.SESSION_SECRET || 'biblioteca-comunitaria-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..')));

// ---- API Routes ----
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/books',  require('./routes/books'));
app.use('/api/users',  require('./routes/users'));
app.use('/api/admin',  require('./routes/admin'));

// ---- API catch-all (all methods) ----
// Return JSON 404 for any unmatched /api/* route
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// ---- SPA fallback ----
// Any non-API route serves index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo excede el límite de 50 MB.' });
  }
  if (err.message && err.message.includes('Formato')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ---- Start ----
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
