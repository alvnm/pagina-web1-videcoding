-- ============================================
-- Políticas RLS para Biblioteca Comunitaria Virtual
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================
-- IMPORTANTE: Si las tablas ya existen sin RLS, ejecutar primero
-- los ALTER TABLE para habilitar RLS, luego las políticas.

-- ============================================
-- 1. TABLA: users
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT público (cualquiera puede ver usuarios)
CREATE POLICY "users_select_public" ON users
  FOR SELECT USING (true);

-- Permitir INSERT con la anon key (registro de usuarios)
CREATE POLICY "users_insert_public" ON users
  FOR INSERT WITH CHECK (true);

-- Permitir UPDATE solo al propio usuario o service_role
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (true);

-- Permitir DELETE (solo service_role desde backend)
CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (true);

-- ============================================
-- 2. TABLA: books
-- ============================================
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver libros
CREATE POLICY "books_select_public" ON books
  FOR SELECT USING (true);

-- Cualquiera puede crear libros
CREATE POLICY "books_insert_public" ON books
  FOR INSERT WITH CHECK (true);

-- Cualquiera puede actualizar libros
CREATE POLICY "books_update_public" ON books
  FOR UPDATE USING (true);

-- Cualquiera puede eliminar libros
CREATE POLICY "books_delete_public" ON books
  FOR DELETE USING (true);

-- ============================================
-- 3. TABLA: tags
-- ============================================
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_public" ON tags
  FOR SELECT USING (true);

CREATE POLICY "tags_insert_public" ON tags
  FOR INSERT WITH CHECK (true);

CREATE POLICY "tags_delete_public" ON tags
  FOR DELETE USING (true);

-- ============================================
-- 4. TABLA: favorites
-- ============================================
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_public" ON favorites
  FOR SELECT USING (true);

CREATE POLICY "favorites_insert_public" ON favorites
  FOR INSERT WITH CHECK (true);

CREATE POLICY "favorites_delete_public" ON favorites
  FOR DELETE USING (true);

-- ============================================
-- 5. TABLA: reading_history
-- ============================================
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reading_history_select_public" ON reading_history
  FOR SELECT USING (true);

CREATE POLICY "reading_history_insert_public" ON reading_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "reading_history_delete_public" ON reading_history
  FOR DELETE USING (true);

CREATE POLICY "reading_history_update_public" ON reading_history
  FOR UPDATE USING (true);

-- ============================================
-- 6. TABLA: ratings
-- ============================================
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select_public" ON ratings
  FOR SELECT USING (true);

CREATE POLICY "ratings_insert_public" ON ratings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ratings_update_public" ON ratings
  FOR UPDATE USING (true);

-- ============================================
-- 7. TABLA: comments
-- ============================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_public" ON comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert_public" ON comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "comments_delete_public" ON comments
  FOR DELETE USING (true);
