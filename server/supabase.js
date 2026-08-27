/* ============================================
   Supabase Client — Server-side
   ============================================ */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nhjmpulzxfpezlseqrtj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oam1wdWx6eGZwZXpsc2VxcnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MjE4NDEsImV4cCI6MjEwMzI5Nzg0MX0.9oV9ASM1kaI2k8VZH5tdELDM-QP2HJN215nTth4u06c';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
