-- ============================================
-- Migración: Eliminar FK problemática en books.user_id
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================
-- La FK books_user_id_fkey fue creada con tipos incompatibles.
-- La app ya maneja la integridad referencial en código.

-- Eliminar la FK constraint de user_id
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_user_id_fkey;

-- Eliminar la FK constraint de uploader_id (si existe)
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_uploader_id_fkey;

RAISE NOTICE '✅ FK constraints eliminadas correctamente';
