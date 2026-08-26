/* ============================================
   Admin Routes — user & book management
   ============================================ */

const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const Store = require('../db');

const router = Router();

// ---- Admin middleware ----
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }
  if (!Store.isAdmin(req.session.user.id)) {
    return res.status(403).json({ error: 'No tienes permisos de administrador.' });
  }
  next();
}

// All admin routes require admin role
router.use(requireAdmin);

// GET /api/admin/stats — dashboard statistics
router.get('/stats', (req, res) => {
  res.json(Store.getAdminStats());
});

// GET /api/admin/users — list all users
router.get('/users', (req, res) => {
  const users = Store.getAllUsers();
  res.json({ users });
});

// PUT /api/admin/users/:id/role — change user role
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'Debes proporcionar un rol.' });
  }

  const result = Store.adminSetUserRole(req.params.id, role);

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
});

// DELETE /api/admin/users/:id — delete a user
router.delete('/users/:id', (req, res) => {
  const userId = Number(req.params.id);

  // Don't allow admin to delete themselves
  if (userId === req.session.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde el panel de admin.' });
  }

  const result = Store.adminDeleteUser(req.params.id);

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
});

// DELETE /api/admin/books/:id — delete any book (admin bypass)
router.delete('/books/:id', (req, res) => {
  const result = Store.adminDeleteBook(req.params.id);

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
});

// GET /api/admin/books — list all books with uploader info
router.get('/books', (req, res) => {
  const books = Store.allBooks();
  res.json({ books });
});

module.exports = router;
