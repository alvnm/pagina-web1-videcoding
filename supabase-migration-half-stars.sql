-- Migración: Soporte para medias estrellas (0.5 incrementos)
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run

-- Cambiar score de INT a DECIMAL(2,1) para soportar 0.5, 1.5, etc.
ALTER TABLE ratings ALTER COLUMN score TYPE DECIMAL(2,1);

-- Actualizar la restricción CHECK para permitir valores de 0.5 a 5.0
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_score_check;
ALTER TABLE ratings ADD CONSTRAINT ratings_score_check CHECK (score >= 0.5 AND score <= 5);
