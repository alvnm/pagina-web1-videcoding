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
router.get('/stats', async (req, res) => {
  try {
    res.json(await Store.getStats());
  } catch (err) {
    console.error('❌ Stats error:', err.message);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await Store.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const books = await Store.booksByUser(user.id);
    const totalDownloads = books.reduce((sum, b) => sum + (b.downloads || 0), 0);

    res.json({
      user,
      books,
      stats: {
        bookCount: books.length,
        totalDownloads,
      },
    });
  } catch (err) {
    console.error('❌ User profile error:', err.message);
    res.status(500).json({ error: 'Error al obtener perfil.' });
  }
});

// PUT /api/users/:id — update profile (owner only)
router.put('/:id', requireAuth, async (req, res) => {
  try {
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
      const fullUser = await Store.findUserByEmail(req.session.user.email);
      if (!fullUser || !bcrypt.compareSync(current_password, fullUser.password)) {
        return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
      }
    }

    const result = await Store.updateUser(userId, { name, email, password });

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
  } catch (err) {
    console.error('❌ Profile update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar perfil.' });
  }
});

// GET /api/users/:id/favorites
router.get('/:id/favorites', async (req, res) => {
  try {
    const user = await Store.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const favorites = await Store.favoritesByUser(user.id);
    res.json({ favorites });
  } catch (err) {
    console.error('❌ Favorites error:', err.message);
    res.status(500).json({ error: 'Error al obtener favoritos.' });
  }
});

// GET /api/users/:id/history
router.get('/:id/history', async (req, res) => {
  try {
    const user = await Store.findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const history = await Store.readingHistoryByUser(user.id);
    res.json({ history });
  } catch (err) {
    console.error('❌ History error:', err.message);
    res.status(500).json({ error: 'Error al obtener historial.' });
  }
});

module.exports = router;
