-- ============================================
-- MIGRACIÓN: Agregar campo cover_url a la tabla books
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================

-- Agregar columna cover_url para almacenar la URL de la imagen de portada
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT '';

-- ============================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================
