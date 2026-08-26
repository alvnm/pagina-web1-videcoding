/* ============================================
   Users Routes — profile, shelf, stats, update
   ============================================ */

const { Router } = require('express');
const Store = require('../db');

const router = Router();

// ---- Auth middleware ----
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  next();
}

// GET /api/users/stats
router.get('/stats', (req, res) => {
  res.json(Store.getStats());
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = Store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const books = Store.booksByUser(user.id);
  const totalDownloads = books.reduce((sum, b) => sum + (b.downloads || 0), 0);

  res.json({
    user,
    books,
    stats: {
      bookCount: books.length,
      totalDownloads,
    },
  });
});

// PUT /api/users/:id — update profile (owner only)
router.put('/:id', requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  if (userId !== req.session.user.id) {
    return res.status(403).json({ error: 'No tienes permiso para editar este perfil.' });
  }

  const { name, email, password, current_password } = req.body;

  // If changing password, require current password
  if (password) {
    if (!current_password) {
      return res.status(400).json({ error: 'Debes ingresar tu contraseña actual para cambiarla.' });
    }
    const bcrypt = require('bcryptjs');
    const fullUser = Store.findUserByEmail(req.session.user.email);
    if (!fullUser || !bcrypt.compareSync(current_password, fullUser.password)) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }
  }

  const result = Store.updateUser(userId, { name, email, password });

  if (result && result.error === 'email_taken') {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' });
  }

  if (!result) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Update session if name or email changed
  if (result.name) req.session.user.name = result.name;
  if (result.email) req.session.user.email = result.email;

  res.json({ user: result });
});

// GET /api/users/:id/favorites
router.get('/:id/favorites', (req, res) => {
  const user = Store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const favorites = Store.favoritesByUser(user.id);
  res.json({ favorites });
});

// GET /api/users/:id/history
router.get('/:id/history', (req, res) => {
  const user = Store.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const history = Store.readingHistoryByUser(user.id);
  res.json({ history });
});

module.exports = router;
