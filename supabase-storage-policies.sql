-- ============================================
-- Políticas de Storage corregidas para bucket "documentos"
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================

-- Primero eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner deletes" ON storage.objects;

-- Permitir subidas desde anon (app usa clave anon sin Supabase Auth)
CREATE POLICY "Allow anon uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'documentos');

-- Permitir que cualquiera lea archivos públicos
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documentos');

-- Permitir que cualquiera borre archivos (app maneja permisos en código)
CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'documentos');
