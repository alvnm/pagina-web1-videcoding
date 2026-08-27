/* ============================================
   Auth Routes — register, login, logout, me
   ============================================ */

const { Router } = require('express');
const bcrypt = require('bcryptjs');
const Store = require('../db');

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const existing = await Store.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const user = await Store.createUser(name.trim(), email.trim(), hash);

    if (!user) {
      return res.status(500).json({ error: 'No se pudo crear el usuario.' });
    }

    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role || 'user' };
    res.status(201).json({ user: req.session.user });
  } catch (err) {
    console.error('❌ Register error:', err.message || err);

    // Provide more specific error messages based on Supabase error codes
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' });
    }
    if (err.code === '42501') {
      return res.status(500).json({ error: 'Error de permisos en la base de datos. Verifica las políticas RLS de Supabase.' });
    }
    if (err.message && err.message.includes('RLS')) {
      return res.status(500).json({ error: 'Error de permisos en la base de datos. Las políticas RLS no están configuradas correctamente.' });
    }

    res.status(500).json({ error: 'Error al crear la cuenta. Inténtalo de nuevo.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }

    const user = await Store.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Correo electrónico no registrado.' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role || 'user' };
    res.json({ user: req.session.user });
  } catch (err) {
    console.error('❌ Login error:', err.message, 'Code:', err.code);
    if (err.code === '42501') {
      return res.status(500).json({ error: 'Error de permisos en la base de datos. Verifica las políticas RLS.' });
    }
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const cookieOpts = {
    path: '/',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
  };
  req.session.destroy((err) => {
    if (err) {
      // Even if destroy fails, clear the cookie so the client is logged out
      res.clearCookie('bcv.sid', cookieOpts);
      return res.status(500).json({ error: 'Error al cerrar sesión.' });
    }
    res.clearCookie('bcv.sid', cookieOpts);
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  res.json({ user: req.session.user });
});

module.exports = router;
