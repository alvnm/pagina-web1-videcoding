/* ============================================
   Express application — API only (for Vercel serverless)
   Static files and SPA fallback are handled by Vercel's CDN.
   ============================================ */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
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

// Session — use Supabase-backed store for persistence across serverless instances
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
    secure: true,              // Vercel serves over HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',           // 'lax' is safer than 'none' — still works for same-site navigations
    path: '/',
  },
}));

// For serverless: clean up expired sessions on a percentage of requests
// (setInterval doesn't work because instances are destroyed after each request)
let _lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // every hour

app.use((req, res, next) => {
  const now = Date.now();
  if (now - _lastCleanup > CLEANUP_INTERVAL_MS) {
    _lastCleanup = now;
    sessionStore.cleanup().catch(() => {});
  }
  next();
});

// ---- Health check (must be before catch-all) ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ---- API Routes ----
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/books',  require('./routes/books'));
app.use('/api/users',  require('./routes/users'));
app.use('/api/admin',  require('./routes/admin'));

// ---- API catch-all (all methods) ----
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message || err);

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
