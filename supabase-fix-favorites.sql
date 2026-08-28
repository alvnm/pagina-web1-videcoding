-- ============================================
-- FIX: Recreate favorites table with correct foreign key
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop the existing favorites table (and its broken foreign key)
DROP TABLE IF EXISTS favorites CASCADE;

-- Step 2: Recreate with correct references
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Step 3: Re-enable RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Step 4: Re-create RLS policies
CREATE POLICY "favorites_select_public" ON favorites FOR SELECT USING (true);
CREATE POLICY "favorites_insert_public" ON favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "favorites_delete_public" ON favorites FOR DELETE USING (true);
