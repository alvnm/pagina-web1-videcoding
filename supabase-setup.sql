-- ============================================
-- Script completo: Bucket 'documentos' + Políticas
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ============================================

-- 1. Crear el bucket como público (50 MB, PDF/EPUB/imágenes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos',
  'documentos',
  true,
  52428800,
  ARRAY['application/pdf', 'application/epub+zip', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: cualquiera puede LEER (descargar)
CREATE POLICY "documentos_select_publico"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documentos');

-- 3. Política: usuarios autenticados pueden SUBIR
CREATE POLICY "documentos_insert_autenticado"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

-- 4. Política: usuarios autenticados pueden ELIMINAR sus propios archivos
CREATE POLICY "documentos_delete_propio"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documentos' AND owner = auth.uid());

-- 5. Política: usuarios autenticados pueden ACTUALIZAR sus propios archivos
CREATE POLICY "documentos_update_propio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documentos' AND owner = auth.uid());
