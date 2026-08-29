/* ============================================
   Cover Generator — Extract first page from PDF/EPUB as cover image
   Uses pdfjs-dist + @napi-rs/canvas for PDFs
   Uses adm-zip for EPUB cover extraction
   Uploads generated covers to Supabase Storage for persistence on Vercel
   Falls back to local disk for local development
   ============================================ */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// On Vercel, use /tmp (the only writable directory in serverless)
const IS_VERCEL = !!process.env.VERCEL;
const UPLOAD_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'uploads');

// Supabase client (lazy init)
let _supabase = null;
function _getSupabase() {
  if (!_supabase) {
    try {
      _supabase = require('./supabase');
    } catch (e) {
      console.log('⚠️ Supabase not available for cover uploads');
    }
  }
  return _supabase;
}

/**
 * Upload a buffer to Supabase Storage and return the public URL
 * Falls back to local disk if Supabase is not available
 * @param {Buffer} buffer - Image data
 * @param {string} filename - Filename for the upload
 * @returns {string} Public URL or local path
 */
async function _uploadCover(buffer, filename) {
  const supabase = _getSupabase();

  // On Vercel or when Supabase is available → upload to Supabase Storage
  if (supabase) {
    try {
      const filePath = `portadas/${filename}`;
      const { error } = await supabase.storage
        .from('documentos')
        .upload(filePath, buffer, {
          contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('⚠️ Supabase upload error:', error.message);
      } else {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('documentos')
          .getPublicUrl(filePath);

        if (urlData && urlData.publicUrl) {
          const publicUrl = urlData.publicUrl;
          console.log(`✅ Cover uploaded to Supabase: ${publicUrl}`);
          return publicUrl;
        }
      }
    } catch (err) {
      console.error('⚠️ Supabase upload failed:', err.message);
    }
  }

  // Fallback: save to local disk (works for local dev)
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    const localPath = `/uploads/${filename}`;
    console.log(`✅ Cover saved locally: ${localPath}`);
    return localPath;
  } catch (err) {
    console.error('⚠️ Local save failed:', err.message);
    return null;
  }
}

/**
 * Download a file from a URL to a temporary local path
 * @param {string} url - Remote URL
 * @returns {object} { tempPath, cleanup }
 */
function _downloadTempFile(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }
    const proto = url.startsWith('https') ? https : http;
    // Detect file extension from URL path (default to .pdf)
    const urlPath = url.split('?')[0];
    const urlExt = path.extname(urlPath).toLowerCase();
    const ext = ['.pdf', '.epub'].includes(urlExt) ? urlExt : '.pdf';
    const tempPath = path.join(UPLOAD_DIR, `_temp_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);

    // Ensure uploads dir exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const file = fs.createWriteStream(tempPath);
    const timer = setTimeout(() => {
      file.close();
      try { fs.unlinkSync(tempPath); } catch {}
      reject(new Error('Download timeout'));
    }, 60000); // 60s timeout

    proto.get(url, { headers: { 'User-Agent': 'BibliotecaComunitaria/1.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        file.close();
        try { fs.unlinkSync(tempPath); } catch {}
        return _downloadTempFile(res.headers.location, maxRedirects - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        file.close();
        try { fs.unlinkSync(tempPath); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        clearTimeout(timer);
        file.close();
        const stats = fs.statSync(tempPath);
        console.log(`📥 Downloaded ${(stats.size / 1024).toFixed(1)} KB to ${tempPath}`);
        resolve({
          tempPath,
          cleanup: () => { try { fs.unlinkSync(tempPath); } catch {} }
        });
      });
      file.on('error', (err) => {
        clearTimeout(timer);
        try { fs.unlinkSync(tempPath); } catch {}
        reject(err);
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      file.close();
      try { fs.unlinkSync(tempPath); } catch {}
      reject(err);
    });
  });
}

/**
 * Extract the first page of a local PDF file as a PNG image buffer
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {Buffer|null} - PNG image buffer, or null if failed
 */
async function _extractPDFFirstPage(pdfPath) {
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

    // Add generous padding so no content gets cropped
    const padX = Math.round(viewport.width * 0.05);
    const padTop = Math.round(viewport.height * 0.08);
    const padBottom = Math.round(viewport.height * 0.08);
    const canvasW = viewport.width + padX * 2;
    const canvasH = viewport.height + padTop + padBottom;

    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');

    // Fill background white so margins look clean
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Render PDF page centered with padding
    await page.render({ canvasContext: ctx, viewport, transform: [1, 0, 0, 1, padX, padTop] }).promise;

    const pngBuffer = canvas.toBuffer('image/png');

    if (!pngBuffer || pngBuffer.length < 100) {
      console.error('❌ Generated image is too small or empty');
      return null;
    }

    console.log(`✅ PDF first page extracted: ${(pngBuffer.length / 1024).toFixed(1)} KB, ${viewport.width}x${Math.round(viewport.height)}`);
    return pngBuffer;
  } catch (err) {
    console.error('⚠️ Error extracting PDF first page:', err.message);
    return null;
  }
}

/**
 * Extract cover image from an EPUB file
 * @param {string} epubPath - Absolute path to the EPUB file
 * @returns {Buffer|null} - Image buffer, or null
 */
async function _extractEPUBCover(epubPath) {
  if (!fs.existsSync(epubPath)) {
    console.error('❌ EPUB file not found:', epubPath);
    return null;
  }

  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(epubPath);
    const entries = zip.getEntries();

    // Find cover image in EPUB
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
        const coverMatch = opfContent.match(/cover-image/i);
        if (coverMatch) {
          const itemMatch = opfContent.match(/<item[^>]+(?:id="cover-image"|properties="cover-image")[^>]+href="([^"]+)"/i)
            || opfContent.match(/<item[^>]+href="([^"]+)"[^>]+(?:id="cover-image"|properties="cover-image")/i);
          if (itemMatch && itemMatch[1]) {
            const coverHref = itemMatch[1];
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

    const imageBuffer = coverEntry.getData();

    if (!imageBuffer || imageBuffer.length < 500) {
      console.log('⚠️ EPUB cover image too small');
      return null;
    }

    console.log(`✅ EPUB cover extracted: ${(imageBuffer.length / 1024).toFixed(1)} KB from ${coverEntry.entryName}`);
    return imageBuffer;
  } catch (err) {
    console.error('⚠️ Error extracting EPUB cover:', err.message);
    return null;
  }
}

/**
 * Generate cover from a book file (local or remote)
 * Extracts first page/cover → uploads to Supabase Storage → returns public URL
 * @param {string} fileUrl - Local path (e.g. '/uploads/file.pdf') or remote URL (https://...)
 * @returns {string|null} - Public URL or local path to the cover image, or null
 */
async function generateCoverFromFile(fileUrl) {
  if (!fileUrl) return null;

  const isRemote = fileUrl.startsWith('http');
  let localPath = null;
  let cleanup = null;

  try {
    if (isRemote) {
      // Download to temp file first
      console.log('📥 Downloading remote file for cover extraction:', fileUrl.substring(0, 80));
      const downloaded = await _downloadTempFile(fileUrl);
      localPath = downloaded.tempPath;
      cleanup = downloaded.cleanup;
    } else {
      // Resolve local path: fileUrl is like '/uploads/file.pdf'
      localPath = path.join(__dirname, fileUrl.replace(/^\/+/, ''));
    }

    if (!fs.existsSync(localPath)) {
      console.error('❌ File not found:', localPath);
      return null;
    }

    const ext = path.extname(localPath).toLowerCase();
    let imageBuffer = null;

    if (ext === '.pdf') {
      console.log('📄 Extracting cover from PDF:', localPath);
      imageBuffer = await _extractPDFFirstPage(localPath);
    } else if (ext === '.epub') {
      console.log('📚 Extracting cover from EPUB:', localPath);
      imageBuffer = await _extractEPUBCover(localPath);
    } else {
      console.log(`ℹ️ No cover extraction supported for ${ext} files`);
      return null;
    }

    if (!imageBuffer) return null;

    // Upload to Supabase Storage (or local disk as fallback)
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e4);
    const filename = `cover-${ext.replace('.', '')}-${timestamp}-${random}.png`;
    const coverUrl = await _uploadCover(imageBuffer, filename);

    return coverUrl;
  } catch (err) {
    console.error('⚠️ generateCoverFromFile error:', err.message);
    return null;
  } finally {
    // Clean up temp file
    if (cleanup) cleanup();
  }
}

/**
 * Legacy: Generate cover from a local PDF file (for backward compatibility)
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {string|null} - Path/URL to the generated cover image
 */
async function generateCoverFromPDF(pdfPath) {
  const buffer = await _extractPDFFirstPage(pdfPath);
  if (!buffer) return null;

  const filename = `cover-pdf-${Date.now()}-${Math.round(Math.random() * 1e4)}.png`;
  return await _uploadCover(buffer, filename);
}

module.exports = { generateCoverFromPDF, generateCoverFromFile };
