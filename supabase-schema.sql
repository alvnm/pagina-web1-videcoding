-- ============================================
-- ESQUEMA COMPLETO: Biblioteca Comunitaria Virtual
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================
-- Incluye: tablas, RLS, y soporte para medias estrellas

-- ============================================
-- 1. TABLAS
-- ============================================

-- 1.1 Usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATE DEFAULT CURRENT_DATE
);

-- 1.2 Libros
CREATE TABLE IF NOT EXISTS books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_type TEXT DEFAULT 'PDF',
  file_name TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  user_id UUID,
  uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  tags ARRAY,
  downloads INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.3 Etiquetas
CREATE TABLE IF NOT EXISTS tags (
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (book_id, tag)
);

-- 1.4 Favoritos
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 1.5 Historial de lectura
CREATE TABLE IF NOT EXISTS reading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 1.6 Calificaciones (con soporte de medias estrellas: 0.5 - 5.0)
CREATE TABLE IF NOT EXISTS ratings (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  score DECIMAL(2,1) NOT NULL CHECK (score >= 0.5 AND score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- 1.7 Comentarios
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. RLS (Row Level Security)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ---------- users ----------
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

-- ---------- books ----------
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

-- ---------- tags ----------
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

-- ---------- favorites ----------
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

-- ---------- reading_history ----------
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

-- ---------- ratings ----------
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

-- ---------- comments ----------
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
-- ✅ ESQUEMA COMPLETADO
-- ============================================
