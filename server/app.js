/* ============================================
   Express application setup (shared by local dev + Vercel)
   ============================================ */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const SupabaseSessionStore = require('./session-store');

// Initialize database (JSON file + seed data)
require('./db');

const app = express();

// ---- Middleware ----
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session — use Supabase-backed store for persistence
const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const sessionStore = new SupabaseSessionStore({
  table: 'sessions',
  ttl: 7 * 24 * 60 * 60, // 7 days in seconds
});

app.use(session({
  name: 'bcv.sid',
  secret: process.env.SESSION_SECRET || 'biblioteca-comunitaria-secret-2026',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: false, // Allow HTTP for local dev; production proxies handle HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
    path: '/',
  },
}));

// Clean up expired sessions periodically (every hour)
setInterval(() => {
  sessionStore.cleanup().catch(() => {});
}, 60 * 60 * 1000);

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
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// ---- SPA fallback ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message || err);
  console.error('❌ Full stack:', err.stack || 'no stack');
  console.error('❌ Error code:', err.code || 'no code');

  // Prevent sending headers twice if response already started
  if (res.headersSent) {
    console.error('⚠️ Headers already sent, ending response');
    return res.end();
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'El archivo excede el límite de 50 MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Campo de archivo inesperado.' });
  }
  if (err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({ error: 'Error en la subida del archivo: ' + err.code });
  }
  if (err.message && err.message.includes('Formato')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Error interno del servidor: ' + (err.message || 'unknown') });
});

module.exports = app;
