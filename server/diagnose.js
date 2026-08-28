/* Quick diagnostic: check column types in Supabase */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://nhjmpulzxfpezlseqrtj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oam1wdWx6eGZwZXpsc2VxcnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MjE4NDEsImV4cCI6MjEwMzI5Nzg0MX0.9oV9ASM1kaI2k8VZH5tdELDM-QP2HJN215nTth4u06c';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
  // 1. Check users table - try to get a user
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, email')
    .limit(3);
  console.log('=== USERS TABLE ===');
  console.log('Users:', users);
  if (users && users.length > 0) {
    const firstUser = users[0];
    console.log('First user id:', firstUser.id, 'type:', typeof firstUser.id);
    console.log('First user id value:', JSON.stringify(firstUser.id));
  }

  // 2. Check favorites table
  const { data: favs, error: fErr } = await supabase
    .from('favorites')
    .select('*')
    .limit(3);
  console.log('\n=== FAVORITES TABLE ===');
  console.log('Favorites:', favs);
  if (fErr) console.log('Favorites error:', fErr);

  // 3. Try inserting a favorite directly with the user's id
  if (users && users.length > 0) {
    const userId = users[0].id;
    console.log('\n=== TRYING INSERT ===');
    console.log('user_id:', userId, ' (type:', typeof userId, ')');
    
    // Try insert
    const { data: insData, error: insErr } = await supabase
      .from('favorites')
      .insert({ user_id: userId, book_id: '2fac22ca-0312-4c90-b4e5-7977a70c492b' })
      .select();
    if (insErr) {
      console.log('INSERT ERROR:', insErr.message);
      console.log('Full error:', JSON.stringify(insErr, null, 2));
    } else {
      console.log('INSERT SUCCESS:', insData);
    }
  }
}

diagnose().catch(console.error);
