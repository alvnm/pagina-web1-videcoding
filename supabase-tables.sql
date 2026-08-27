-- ============================================
-- Tablas de la Biblioteca Comunitaria Virtual
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================

-- 1. Usuarios
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATE DEFAULT CURRENT_DATE
);

-- 2. Libros
CREATE TABLE IF NOT EXISTS books (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_type TEXT DEFAULT 'PDF',
  file_name TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  uploader_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATE DEFAULT CURRENT_DATE,
  downloads INT DEFAULT 0
);

-- 3. Etiquetas
CREATE TABLE IF NOT EXISTS tags (
  book_id BIGINT REFERENCES books(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (book_id, tag)
);

-- 4. Favoritos
CREATE TABLE IF NOT EXISTS favorites (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  book_id BIGINT REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- 5. Historial de lectura
CREATE TABLE IF NOT EXISTS reading_history (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  book_id BIGINT REFERENCES books(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- 6. Calificaciones
CREATE TABLE IF NOT EXISTS ratings (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  book_id BIGINT REFERENCES books(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- 7. Comentarios
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  book_id BIGINT REFERENCES books(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
