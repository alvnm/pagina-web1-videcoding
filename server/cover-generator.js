/* ============================================
   Cover Generator — Extract first page from PDF as cover image
   Uses pdf2pic (requires GraphicsMagick or ImageMagick installed)
   Falls back gracefully if dependencies are not available
   ============================================ */

const path = require('path');
const fs = require('fs');

let pdf2pic = null;
try {
  pdf2pic = require('pdf2pic');
} catch (e) {
  console.log('⚠️ pdf2pic not installed. Auto-cover generation from PDF will be disabled.');
  console.log('   To enable: npm install pdf2pic && install GraphicsMagick or ImageMagick');
}

/**
 * Generate a cover image from the first page of a PDF file
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {string|null} - Relative path to the generated cover image, or null if failed
 */
async function generateCoverFromPDF(pdfPath) {
  // If pdf2pic is not available, return null
  if (!pdf2pic) {
    return null;
  }

  // Check if PDF file exists
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found:', pdfPath);
    return null;
  }

  try {
    // Configure pdf2pic
    const options = {
      density: 150,           // DPI for the output image
      saveFilename: 'cover',  // Base filename
      savePath: path.dirname(pdfPath), // Save in same directory as PDF
      format: 'png',          // Output format
      width: 400,             // Max width
      height: 600,            // Max height
    };

    const convert = pdf2pic.fromPath(pdfPath, options);

    // Convert first page (page 1)
    const result = await convert(1, { responseType: 'image' });

    if (result && result.path) {
      // Return the relative path from the project root
      const relativePath = path.relative(path.join(__dirname, '..'), result.path);
      console.log('✅ Cover generated from PDF:', relativePath);
      return relativePath;
    }

    return null;
  } catch (err) {
    console.error('⚠️ Error generating cover from PDF:', err.message);
    return null;
  }
}

module.exports = { generateCoverFromPDF };
