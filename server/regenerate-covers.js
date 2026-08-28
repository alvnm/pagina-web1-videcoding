#!/usr/bin/env node
/* ============================================
   Regenerate Covers Script
   Finds all books with placeholder or missing covers
   and attempts to regenerate them via:
   1. PDF/EPUB first page extraction
   2. Open Library API search
   3. Better SVG placeholder as fallback
   ============================================ */

const coverService = require('./cover-service');
const Store = require('./db');

async function main() {
  console.log('🔍 Finding books with placeholder or missing covers...\n');

  const allBooks = await Store.allBooks();
  const booksToProcess = allBooks.filter(b => {
    if (!b.cover_url || b.cover_url === '') return true;
    if (b.cover_url.includes('cover-placeholder-')) return true;
    if (b.cover_url.includes('data:image/svg+xml')) return true;
    // Also catch covers that are SVG files on disk
    if (b.cover_url.endsWith('.svg')) return true;
    return false;
  });

  console.log(`📚 Found ${booksToProcess.length} books to process (out of ${allBooks.length} total)\n`);

  if (booksToProcess.length === 0) {
    console.log('✅ All books already have covers!');
    process.exit(0);
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < booksToProcess.length; i++) {
    const book = booksToProcess[i];
    console.log(`[${i + 1}/${booksToProcess.length}] 📖 "${book.title}" by ${book.author}`);

    try {
      let coverUrl = null;

      // Try extractCoverFromBook (PDF → Open Library → Placeholder)
      try {
        coverUrl = await coverService.extractCoverFromBook(book);
      } catch (coverErr) {
        console.error(`   ❌ extractCoverFromBook error: ${coverErr.message}`);
      }

      if (coverUrl && coverUrl !== book.cover_url) {
        await Store.updateBookCover(book.id, coverUrl);
        generated++;
        console.log(`   ✅ Cover generated: ${coverUrl.substring(0, 80)}...`);
      } else if (coverUrl) {
        skipped++;
        console.log(`   ⏭️ Cover unchanged (same URL)`);
      } else {
        skipped++;
        console.log(`   ⏭️ Skipped (no cover found)`);
      }
    } catch (err) {
      errors++;
      console.error(`   ❌ Error: ${err.message}`);
    }

    // Small delay between requests to be nice to APIs
    if (i < booksToProcess.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results:`);
  console.log(`   ✅ Generated: ${generated}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📚 Total processed: ${booksToProcess.length}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
