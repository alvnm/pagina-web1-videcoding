-- ============================================
-- Migración completa: Habilitar RLS + Políticas
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Para bases de datos que ya existen sin RLS configurado
-- ============================================

-- ============================================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. POLÍTICAS PARA: users
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
-- 3. POLÍTICAS PARA: books
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
-- 4. POLÍTICAS PARA: tags
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
-- 5. POLÍTICAS PARA: favorites
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
-- 6. POLÍTICAS PARA: reading_history
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
-- 7. POLÍTICAS PARA: ratings
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
-- 8. POLÍTICAS PARA: comments
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
-- 9. Migración: Agregar id a reading_history si no existe
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_history' AND column_name = 'id'
  ) THEN
    ALTER TABLE reading_history ADD COLUMN id BIGSERIAL;
    ALTER TABLE reading_history DROP CONSTRAINT reading_history_pkey;
    ALTER TABLE reading_history ADD PRIMARY KEY (id);
    ALTER TABLE reading_history ADD CONSTRAINT reading_history_user_book_unique UNIQUE (user_id, book_id);
    RAISE NOTICE 'Columna id agregada a reading_history';
  END IF;
END $$;

RAISE NOTICE '✅ Migración completada. Todas las políticas RLS configuradas.';
