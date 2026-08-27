-- ============================================
-- Verificación completa de tablas y políticas RLS
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================

-- ============================================
-- 1. VERIFICAR TABLAS EXISTENTES
-- ============================================
DO $$
DECLARE
  t RECORD;
  expected_tables TEXT[] := ARRAY['users', 'books', 'tags', 'favorites', 'reading_history', 'ratings', 'comments'];
  tbl TEXT;
  missing TEXT[] := '{}';
BEGIN
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '  VERIFICACIÓN DE TABLAS';
  RAISE NOTICE '══════════════════════════════════════════';

  FOREACH tbl IN ARRAY expected_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      RAISE NOTICE '  ✅ Tabla "%" existe', tbl;
    ELSE
      RAISE NOTICE '  ❌ Tabla "%" NO existe', tbl;
      missing := array_append(missing, tbl);
    END IF;
  END LOOP;

  IF array_length(missing, 1) > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '  ⚠️  Faltan tablas: %', array_to_string(missing, ', ');
    RAISE NOTICE '  → Ejecuta supabase-schema.sql para crearlas';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '  ✅ Todas las tablas existen';
  END IF;
END $$;

-- ============================================
-- 2. VERIFICAR RLS HABILITADO
-- ============================================
DO $$
DECLARE
  r RECORD;
  expected_tables TEXT[] := ARRAY['users', 'books', 'tags', 'favorites', 'reading_history', 'ratings', 'comments'];
  tbl TEXT;
  rls_disabled TEXT[] := '{}';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '  VERIFICACIÓN DE RLS (Row Level Security)';
  RAISE NOTICE '══════════════════════════════════════════';

  FOREACH tbl IN ARRAY expected_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND c.relname = tbl
      AND c.relrowsecurity = true
    ) THEN
      RAISE NOTICE '  ✅ RLS habilitado en "%"', tbl;
    ELSE
      RAISE NOTICE '  ❌ RLS NO habilitado en "%"', tbl;
      rls_disabled := array_append(rls_disabled, tbl);
    END IF;
  END LOOP;

  IF array_length(rls_disabled, 1) > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '  ⚠️  RLS deshabilitado en: %', array_to_string(rls_disabled, ', ');
    RAISE NOTICE '  → Ejecuta: ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY;';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '  ✅ RLS habilitado en todas las tablas';
  END IF;
END $$;

-- ============================================
-- 3. VERIFICAR POLÍTICAS POR TABLA
-- ============================================
DO $$
DECLARE
  r RECORD;
  tbl TEXT;
  policy_count INT;
  expected_policies TEXT[] := ARRAY[
    'users_select_public', 'users_insert_public', 'users_update_public', 'users_delete_public',
    'books_select_public', 'books_insert_public', 'books_update_public', 'books_delete_public',
    'tags_select_public', 'tags_insert_public', 'tags_delete_public',
    'favorites_select_public', 'favorites_insert_public', 'favorites_delete_public',
    'reading_history_select_public', 'reading_history_insert_public', 'reading_history_delete_public', 'reading_history_update_public',
    'ratings_select_public', 'ratings_insert_public', 'ratings_update_public',
    'comments_select_public', 'comments_insert_public', 'comments_delete_public'
  ];
  pol TEXT;
  missing_policies TEXT[] := '{}';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '  VERIFICACIÓN DE POLÍTICAS RLS';
  RAISE NOTICE '══════════════════════════════════════════';

  FOREACH pol IN ARRAY expected_policies LOOP
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = pol AND schemaname = 'public') THEN
      RAISE NOTICE '  ✅ Política "%" existe', pol;
    ELSE
      RAISE NOTICE '  ❌ Política "%" NO existe', pol;
      missing_policies := array_append(missing_policies, pol);
    END IF;
  END LOOP;

  IF array_length(missing_policies, 1) > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '  ⚠️  Faltan % política(s): %', array_length(missing_policies, 1), array_to_string(missing_policies, ', ');
    RAISE NOTICE '  → Ejecuta supabase-schema.sql para crearlas';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '  ✅ Todas las políticas RLS están configuradas';
  END IF;
END $$;

-- ============================================
-- 4. VERIFICAR COLUMNAS DE reading_history
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE '  VERIFICACIÓN DE reading_history';
  RAISE NOTICE '══════════════════════════════════════════';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reading_history' AND column_name = 'id'
  ) THEN
    RAISE NOTICE '  ✅ Columna "id" existe en reading_history';
  ELSE
    RAISE NOTICE '  ❌ Columna "id" NO existe en reading_history';
    RAISE NOTICE '  → Ejecuta supabase-schema.sql';
  END IF;
END $$;

-- ============================================
-- 5. RESUMEN DE POLÍTICAS POR TABLA
-- ============================================
SELECT
  tablename,
  COUNT(*) as policy_count,
  string_agg(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- 6. VERIFICAR RESTRICCIONES UNIQUE
-- ============================================
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'u'
AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text;
