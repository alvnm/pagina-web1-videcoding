/* ============================================
   Cover Generator — Extract first page from PDF/EPUB as cover image
   Uses pdfjs-dist + @napi-rs/canvas for PDFs
   Uses epub2 for EPUB cover extraction
   Downloads remote files temporarily when needed
   ============================================ */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

/**
 * Download a file from a URL to a temporary local path
 * @param {string} url - Remote URL
 * @returns {string} Path to the temporary file
 */
function _downloadTempFile(url, extHint) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const ext = extHint || '.pdf';
    const tempPath = path.join(UPLOAD_DIR, `_temp_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
    const file = fs.createWriteStream(tempPath);

    proto.get(url, { headers: { 'User-Agent': 'BibliotecaComunitaria/1.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(tempPath);
        return _downloadTempFile(res.headers.location, extHint).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(tempPath);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(tempPath); });
      file.on('error', (err) => { fs.unlinkSync(tempPath); reject(err); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      reject(err);
    });
  });
}

/**
 * Extract the first page of a local PDF file as a PNG image
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {string|null} - Relative path to the generated cover image, or null if failed
 */
async function generateCoverFromPDF(pdfPath) {
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    return null;
  }

  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('@napi-rs/canvas');

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    if (!doc || doc.numPages === 0) {
      console.error('❌ PDF has no pages');
      return null;
    }

    const page = await doc.getPage(1);

    // Scale to reasonable cover size (max 800px wide)
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const maxWidth = 800;
    const scale = Math.min(maxWidth / unscaledViewport.width, 2.0);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const pngBuffer = canvas.toBuffer('image/png');

    if (!pngBuffer || pngBuffer.length < 100) {
      console.error('❌ Generated image is too small or empty');
      return null;
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const filename = `cover-pdf-${Date.now()}-${Math.round(Math.random() * 1e4)}.png`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, pngBuffer);

    const relativePath = `/uploads/${filename}`;
    console.log(`✅ Cover extracted from PDF: ${relativePath} (${(pngBuffer.length / 1024).toFixed(1)} KB, ${viewport.width}x${viewport.height})`);

    return relativePath;
  } catch (err) {
    console.error('⚠️ Error generating cover from PDF:', err.message);
    return null;
  }
}

/**
 * Extract cover image from an EPUB file
 * EPUBs often have a cover image embedded. We extract it.
 * @param {string} epubPath - Absolute path to the EPUB file
 * @returns {string|null} - Relative path to the extracted cover image, or null
 */
async function generateCoverFromEPUB(epubPath) {
  if (!fs.existsSync(epubPath)) {
    console.error('❌ EPUB file not found:', epubPath);
    return null;
  }

  try {
    // Try to use @napi-rs/canvas for EPUB: read the zip structure
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(epubPath);
    const entries = zip.getEntries();

    // Find cover image in EPUB
    // Common paths: OEBPS/cover.jpg, OEBPS/images/cover.jpg, cover.jpg, etc.
    const coverPatterns = [
      /cover\.(jpg|jpeg|png|gif|webp)/i,
      /OEBPS\/images?\/cover/i,
      /OEBPS\/cover/i,
      /images\/cover/i,
    ];

    let coverEntry = null;

    // First try: find an image file named "cover"
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      for (const pattern of coverPatterns) {
        if (pattern.test(entry.entryName)) {
          coverEntry = entry;
          break;
        }
      }
      if (coverEntry) break;
    }

    // Second try: look at the OPF file for cover-image property
    if (!coverEntry) {
      const opfEntry = entries.find(e => /content\.opf$/i.test(e.entryName));
      if (opfEntry) {
        const opfContent = opfEntry.getData().toString('utf8');
        // Look for cover-image meta
        const coverMatch = opfContent.match(/cover-image/i);
        if (coverMatch) {
          // Find the item with id="cover-image" or properties="cover-image"
          const itemMatch = opfContent.match(/<item[^>]+(?:id="cover-image"|properties="cover-image")[^>]+href="([^"]+)"/i)
            || opfContent.match(/<item[^>]+href="([^"]+)"[^>]+(?:id="cover-image"|properties="cover-image")/i);
          if (itemMatch && itemMatch[1]) {
            const coverHref = itemMatch[1];
            // Find the entry matching this href
            const dirPath = path.dirname(opfEntry.entryName);
            const fullCoverPath = dirPath === '.' ? coverHref : dirPath + '/' + coverHref;
            coverEntry = entries.find(e => e.entryName === fullCoverPath || e.entryName.endsWith('/' + coverHref));
          }
        }
      }
    }

    // Third try: find the largest image file (likely the cover)
    if (!coverEntry) {
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      let maxSize = 0;
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const ext = path.extname(entry.entryName).toLowerCase();
        if (imageExts.includes(ext) && entry.header.size > maxSize) {
          maxSize = entry.header.size;
          coverEntry = entry;
        }
      }
    }

    if (!coverEntry) {
      console.log('⚠️ No cover image found in EPUB');
      return null;
    }

    const ext = path.extname(coverEntry.entryName).toLowerCase();
    const imageBuffer = coverEntry.getData();

    if (!imageBuffer || imageBuffer.length < 500) {
      console.log('⚠️ EPUB cover image too small');
      return null;
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const filename = `cover-epub-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, imageBuffer);

    const relativePath = `/uploads/${filename}`;
    console.log(`✅ Cover extracted from EPUB: ${relativePath} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
    return relativePath;
  } catch (err) {
    console.error('⚠️ Error generating cover from EPUB:', err.message);
    return null;
  }
}

/**
 * Main function: Generate cover from a book file (local or remote)
 * Tries PDF first page extraction → EPUB cover extraction
 * @param {string} fileUrl - Local path (e.g. '/uploads/file.pdf') or remote URL (https://...)
 * @returns {string|null} - Relative path to generated cover, or null
 */
async function generateCoverFromFile(fileUrl) {
  if (!fileUrl) return null;

  const isRemote = fileUrl.startsWith('http');
  let localPath = null;
  let tempFile = false;

  try {
    if (isRemote) {
      // Download to temp file first
      console.log('📥 Downloading remote file for cover extraction:', fileUrl.substring(0, 80));
      const extHint = path.extname(fileUrl.split('?')[0]).toLowerCase() || '.pdf';
      localPath = await _downloadTempFile(fileUrl, extHint);
      tempFile = true;
    } else {
      // Resolve local path: fileUrl is like '/uploads/file.pdf'
      localPath = path.join(__dirname, fileUrl.replace(/^\/+/, ''));
    }

    if (!fs.existsSync(localPath)) {
      console.error('❌ File not found:', localPath);
      return null;
    }

    const ext = path.extname(localPath).toLowerCase();

    if (ext === '.pdf') {
      console.log('📄 Extracting cover from PDF:', localPath);
      return await generateCoverFromPDF(localPath);
    }

    if (ext === '.epub') {
      console.log('📚 Extracting cover from EPUB:', localPath);
      return await generateCoverFromEPUB(localPath);
    }

    console.log(`ℹ️ No cover extraction supported for ${ext} files`);
    return null;
  } catch (err) {
    console.error('⚠️ generateCoverFromFile error:', err.message);
    return null;
  } finally {
    // Clean up temp file
    if (tempFile && localPath && fs.existsSync(localPath)) {
      try { fs.unlinkSync(localPath); } catch { /* ignore */ }
    }
  }
}

module.exports = { generateCoverFromPDF, generateCoverFromEPUB, generateCoverFromFile };
