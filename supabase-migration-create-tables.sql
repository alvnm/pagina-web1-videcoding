-- ============================================
-- Migración: Crear tablas faltantes (UUID types)
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================
-- NOTA: Tu base de datos usa UUID para las PKs.
-- Este script es compatible con ese esquema.

-- ============================================
-- 1. TABLA: users (necesaria para autenticación)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATE DEFAULT CURRENT_DATE
);

-- ============================================
-- 2. AJUSTAR TABLA: books
--    - Agregar uploader_id si falta
--    - Agregar columnas faltantes
-- ============================================

-- Agregar uploader_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'uploader_id'
  ) THEN
    ALTER TABLE books ADD COLUMN uploader_id UUID REFERENCES users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Columna uploader_id agregada a books';
  END IF;
END $$;

-- Agregar file_type si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE books ADD COLUMN file_type TEXT DEFAULT 'PDF';
  END IF;
END $$;

-- Agregar file_name si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE books ADD COLUMN file_name TEXT DEFAULT '';
  END IF;
END $$;

-- Agregar file_path si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'books' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE books ADD COLUMN file_path TEXT DEFAULT '';
  END IF;
END $$;

-- ============================================
-- 3. TABLA: tags (etiquetas de libros)
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (book_id, tag)
);

-- ============================================
-- 4. TABLA: reading_history (historial de lectura)
-- ============================================
CREATE TABLE IF NOT EXISTS reading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- ============================================
-- 5. TABLA: ratings (calificaciones)
-- ============================================
CREATE TABLE IF NOT EXISTS ratings (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- ============================================
-- 6. TABLA: comments (comentarios)
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. POLÍTICAS RLS - users
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_select_public') THEN
    CREATE POLICY "users_select_public" ON users FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_insert_public') THEN
    CREATE POLICY "users_insert_public" ON users FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_update_public') THEN
    CREATE POLICY "users_update_public" ON users FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_delete_public') THEN
    CREATE POLICY "users_delete_public" ON users FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================
-- 9. POLÍTICAS RLS - books
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'books_select_public') THEN
    CREATE POLICY "books_select_public" ON books FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'books_insert_public') THEN
    CREATE POLICY "books_insert_public" ON books FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'books_update_public') THEN
    CREATE POLICY "books_update_public" ON books FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'books_delete_public') THEN
    CREATE POLICY "books_delete_public" ON books FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================
-- 10. POLÍTICAS RLS - tags
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tags_select_public') THEN
    CREATE POLICY "tags_select_public" ON tags FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tags_insert_public') THEN
    CREATE POLICY "tags_insert_public" ON tags FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tags_delete_public') THEN
    CREATE POLICY "tags_delete_public" ON tags FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================
-- 11. POLÍTICAS RLS - favorites
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'favorites_select_public') THEN
    CREATE POLICY "favorites_select_public" ON favorites FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'favorites_insert_public') THEN
    CREATE POLICY "favorites_insert_public" ON favorites FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'favorites_delete_public') THEN
    CREATE POLICY "favorites_delete_public" ON favorites FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================
-- 12. POLÍTICAS RLS - reading_history
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reading_history_select_public') THEN
    CREATE POLICY "reading_history_select_public" ON reading_history FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reading_history_insert_public') THEN
    CREATE POLICY "reading_history_insert_public" ON reading_history FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reading_history_delete_public') THEN
    CREATE POLICY "reading_history_delete_public" ON reading_history FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reading_history_update_public') THEN
    CREATE POLICY "reading_history_update_public" ON reading_history FOR UPDATE USING (true);
  END IF;
END $$;

-- ============================================
-- 13. POLÍTICAS RLS - ratings
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ratings_select_public') THEN
    CREATE POLICY "ratings_select_public" ON ratings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ratings_insert_public') THEN
    CREATE POLICY "ratings_insert_public" ON ratings FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ratings_update_public') THEN
    CREATE POLICY "ratings_update_public" ON ratings FOR UPDATE USING (true);
  END IF;
END $$;

-- ============================================
-- 14. POLÍTICAS RLS - comments
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_select_public') THEN
    CREATE POLICY "comments_select_public" ON comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_insert_public') THEN
    CREATE POLICY "comments_insert_public" ON comments FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_delete_public') THEN
    CREATE POLICY "comments_delete_public" ON comments FOR DELETE USING (true);
  END IF;
END $$;

-- ============================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================
