-- ============================================
-- STORAGE: Bucket 'documentos' + Políticas
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================

-- 1. Crear el bucket como público (200 MB, PDF/EPUB/imágenes/DOC)
--    IMPORTANTE: Usar DO UPDATE para forzar actualización del file_size_limit
--    Si el bucket ya existía con un límite menor, esta SQL lo actualiza a 200 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos',
  'documentos',
  true,
  209715200,
  ARRAY[
    'application/pdf',
    'application/epub+zip',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-mobipocket-ebook',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 209715200,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/epub+zip',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-mobipocket-ebook',
    'application/octet-stream'
  ],
  public = true;

-- 2. Eliminar políticas existentes (evita conflictos al re-ejecutar)
DROP POLICY IF EXISTS "Allow anon uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;

-- 3. Permitir subidas desde anon (app usa clave anon sin Supabase Auth)
CREATE POLICY "Allow anon uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'documentos');

-- 4. Permitir que cualquiera lea archivos públicos
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documentos');

-- 5. Permitir que cualquiera borre archivos (app maneja permisos en código)
CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'documentos');

-- ============================================
-- ✅ STORAGE COMPLETADO
-- ============================================
