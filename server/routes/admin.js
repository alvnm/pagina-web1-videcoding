/* ============================================
   Admin Routes — user & book management
   ============================================ */

const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const Store = require('../db');

const router = Router();

// ---- Admin middleware ----
async function requireAdmin(req, res, next) {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión.' });
    }
    const isAdmin = await Store.isAdmin(req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos de administrador.' });
    }
    next();
  } catch (err) {
    console.error('❌ Admin auth error:', err.message);
    res.status(500).json({ error: 'Error de autenticación.' });
  }
}

// All admin routes require admin role
router.use(requireAdmin);

// GET /api/admin/stats — dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Store.getAdminStats();
    res.json(stats);
  } catch (err) {
    console.error('❌ Admin stats error:', err.message);
    res.status(500).json({ error: 'Error al obtener estadísticas.' });
  }
});

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  try {
    const users = await Store.getAllUsers();
    res.json({ users });
  } catch (err) {
    console.error('❌ Admin users error:', err.message);
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

// PUT /api/admin/users/:id/role — change user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'Debes proporcionar un rol.' });
    }

    const result = await Store.adminSetUserRole(req.params.id, role);

    if (result && result.error === 'not_found') {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (result && result.error === 'invalid_role') {
      return res.status(400).json({ error: 'Rol inválido. Usa "admin" o "user".' });
    }
    if (result && result.error === 'last_admin') {
      return res.status(400).json({ error: 'No puedes quitar el rol de admin al último administrador.' });
    }

    res.json({ user: result });
  } catch (err) {
    console.error('❌ Admin role error:', err.message);
    res.status(500).json({ error: 'Error al cambiar rol.' });
  }
});

// DELETE /api/admin/users/:id — delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    // Don't allow admin to delete themselves
    if (userId === req.session.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde el panel de admin.' });
    }

    const result = await Store.adminDeleteUser(req.params.id);

    if (result && result.error === 'not_found') {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (result && result.error === 'last_admin') {
      return res.status(400).json({ error: 'No puedes eliminar al último administrador.' });
    }

    // Clean up uploaded files
    if (result.deletedFilePaths) {
      for (const filePath of result.deletedFilePaths) {
        if (filePath) {
          const fullPath = path.join(__dirname, '..', filePath);
          if (fs.existsSync(fullPath)) {
            try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
          }
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Admin delete user error:', err.message);
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
});

// DELETE /api/admin/books/:id — delete any book (admin bypass)
router.delete('/books/:id', async (req, res) => {
  try {
    const result = await Store.adminDeleteBook(req.params.id);

    if (result && result.error === 'not_found') {
      return res.status(404).json({ error: 'Documento no encontrado.' });
    }

    // Clean up uploaded file
    if (result.file_path) {
      const filePath = path.join(__dirname, '..', result.file_path);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Admin delete book error:', err.message);
    res.status(500).json({ error: 'Error al eliminar documento.' });
  }
});

// GET /api/admin/books — list all books with uploader info
router.get('/books', async (req, res) => {
  try {
    const books = await Store.allBooks();
    res.json({ books });
  } catch (err) {
    console.error('❌ Admin books error:', err.message);
    res.status(500).json({ error: 'Error al obtener libros.' });
  }
});

module.exports = router;
