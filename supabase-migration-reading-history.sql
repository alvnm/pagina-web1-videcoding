-- ============================================
-- Migración: Agregar columna id a reading_history
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Solo ejecutar si reading_history ya existe sin columna id
-- ============================================

-- Verificar si la columna id ya existe en reading_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reading_history' AND column_name = 'id'
  ) THEN
    -- Agregar columna id como secuencia auto-incremental
    ALTER TABLE reading_history ADD COLUMN id BIGSERIAL;

    -- Eliminar la PRIMARY KEY antigua (user_id, book_id)
    ALTER TABLE reading_history DROP CONSTRAINT reading_history_pkey;

    -- Agregar PRIMARY KEY en la nueva columna id
    ALTER TABLE reading_history ADD PRIMARY KEY (id);

    -- Mantener la restricción UNIQUE en (user_id, book_id)
    ALTER TABLE reading_history ADD CONSTRAINT reading_history_user_book_unique UNIQUE (user_id, book_id);

    RAISE NOTICE 'Columna id agregada a reading_history correctamente';
  ELSE
    RAISE NOTICE 'La columna id ya existe en reading_history';
  END IF;
END $$;

-- Habilitar RLS si no está habilitado
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;

-- Crear políticas si no existen
DO $$
BEGIN
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
