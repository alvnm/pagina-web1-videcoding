-- ============================================
-- Tablas de la Biblioteca Comunitaria Virtual
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================
-- NOTA: Este esquema usa UUID para las PKs,
-- compatible con tu base de datos de Supabase.

-- 1. Usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATE DEFAULT CURRENT_DATE
);

-- 2. Libros
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

-- 3. Etiquetas
CREATE TABLE IF NOT EXISTS tags (
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (book_id, tag)
);

-- 4. Favoritos
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 5. Historial de lectura
CREATE TABLE IF NOT EXISTS reading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 6. Calificaciones
CREATE TABLE IF NOT EXISTS ratings (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- 7. Comentarios
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- Necesarias para que el backend funcione con
-- la anon key de Supabase
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ---------- users ----------
CREATE POLICY "users_select_public" ON users
  FOR SELECT USING (true);

CREATE POLICY "users_insert_public" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_public" ON users
  FOR UPDATE USING (true);

CREATE POLICY "users_delete_public" ON users
  FOR DELETE USING (true);

-- ---------- books ----------
CREATE POLICY "books_select_public" ON books
  FOR SELECT USING (true);

CREATE POLICY "books_insert_public" ON books
  FOR INSERT WITH CHECK (true);

CREATE POLICY "books_update_public" ON books
  FOR UPDATE USING (true);

CREATE POLICY "books_delete_public" ON books
  FOR DELETE USING (true);

-- ---------- tags ----------
CREATE POLICY "tags_select_public" ON tags
  FOR SELECT USING (true);

CREATE POLICY "tags_insert_public" ON tags
  FOR INSERT WITH CHECK (true);

CREATE POLICY "tags_delete_public" ON tags
  FOR DELETE USING (true);

-- ---------- favorites ----------
CREATE POLICY "favorites_select_public" ON favorites
  FOR SELECT USING (true);

CREATE POLICY "favorites_insert_public" ON favorites
  FOR INSERT WITH CHECK (true);

CREATE POLICY "favorites_delete_public" ON favorites
  FOR DELETE USING (true);

-- ---------- reading_history ----------
CREATE POLICY "reading_history_select_public" ON reading_history
  FOR SELECT USING (true);

CREATE POLICY "reading_history_insert_public" ON reading_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "reading_history_delete_public" ON reading_history
  FOR DELETE USING (true);

CREATE POLICY "reading_history_update_public" ON reading_history
  FOR UPDATE USING (true);

-- ---------- ratings ----------
CREATE POLICY "ratings_select_public" ON ratings
  FOR SELECT USING (true);

CREATE POLICY "ratings_insert_public" ON ratings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ratings_update_public" ON ratings
  FOR UPDATE USING (true);

-- ---------- comments ----------
CREATE POLICY "comments_select_public" ON comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert_public" ON comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "comments_delete_public" ON comments
  FOR DELETE USING (true);
