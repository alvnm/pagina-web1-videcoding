/* ============================================
   Cover Generator — Extract first page from PDF as cover image
   Uses pdfjs-dist + @napi-rs/canvas (pure JS, no Ghostscript needed)
   Falls back gracefully if dependencies are not available
   ============================================ */

const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

/**
 * Generate a cover image from the first page of a PDF file
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {string|null} - Relative path to the generated cover image, or null if failed
 */
async function generateCoverFromPDF(pdfPath) {
  // Check if PDF file exists
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    return null;
  }

  try {
    // Dynamic import for ESM modules (pdfjs-dist and @napi-rs/canvas)
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('@napi-rs/canvas');

    // Read PDF file
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    if (!doc || doc.numPages === 0) {
      console.error('❌ PDF has no pages');
      return null;
    }

    // Get first page
    const page = await doc.getPage(1);

    // Scale to reasonable cover size (max 800px wide)
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const maxWidth = 800;
    const scale = Math.min(maxWidth / unscaledViewport.width, 2.0);
    const viewport = page.getViewport({ scale });

    // Create canvas and render
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // Convert to PNG buffer
    const pngBuffer = canvas.toBuffer('image/png');

    if (!pngBuffer || pngBuffer.length < 100) {
      console.error('❌ Generated image is too small or empty');
      return null;
    }

    // Save to uploads directory
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

module.exports = { generateCoverFromPDF };
