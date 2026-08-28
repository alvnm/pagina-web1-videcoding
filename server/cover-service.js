/* ============================================
   Cover Service — Auto-fetch & generate book covers
   Uses Open Library Covers API (free, no key needed)
   Generates SVG placeholder covers as fallback
   ============================================ */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Import cover generator (PDF + EPUB extraction)
let generateCoverFromFile;
try {
  ({ generateCoverFromFile } = require('./cover-generator'));
} catch (e) {
  console.log('⚠️ cover-generator not available for file extraction');
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  console.error('⚠️ Could not create uploads dir:', e.message);
}

// ---- HTTP helpers ----

function _fetchJSON(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const timer = setTimeout(() => { try { reject(new Error('Timeout')); } catch {} }, timeoutMs);
    proto.get(url, { headers: { 'User-Agent': 'BibliotecaComunitaria/1.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return _fetchJSON(res.headers.location, timeoutMs).then(resolve, reject);
      }
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
      res.on('error', (err) => { clearTimeout(timer); reject(err); });
    }).on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function _fetchBuffer(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    proto.get(url, { headers: { 'User-Agent': 'BibliotecaComunitaria/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return _fetchBuffer(res.headers.location, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
      res.on('error', (err) => { clearTimeout(timer); reject(err); });
    }).on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ---- Open Library API ----

/**
 * Search Open Library for a book cover by title and author
 * @returns {string|null} URL of the cover image, or null
 */
async function searchOpenLibraryCover(title, author) {
  if (!title) return null;
  try {
    const searchQuery = encodeURIComponent(title + (author ? ' ' + author : ''));
    const data = await _fetchJSON(
      `https://openlibrary.org/search.json?title=${searchQuery}&limit=5`
    );
    if (!data || !data.docs || data.docs.length === 0) return null;

    // Find the best match
    for (const doc of data.docs) {
      // Prefer edition covers
      if (doc.cover_i) {
        const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        return coverUrl;
      }
      // Try ISBN covers
      if (doc.isbn && doc.isbn.length > 0) {
        const isbn = doc.isbn[doc.isbn.length - 1]; // last ISBN usually best
        const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        return coverUrl;
      }
    }
    return null;
  } catch (err) {
    console.error('⚠️ Open Library search error:', err.message);
    return null;
  }
}

/**
 * Get cover by ISBN from Open Library
 */
async function getCoverByISBN(isbn) {
  if (!isbn) return null;
  try {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    const buffer = await _fetchBuffer(url);
    if (buffer && buffer.length > 500) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search Open Library and return multiple cover options
 * @returns {Array<{url: string, title: string, author: string, year: string}>}
 */
async function searchCovers(title, author, limit = 6) {
  if (!title) return [];
  try {
    const searchQuery = encodeURIComponent(title + (author ? ' ' + author : ''));
    const data = await _fetchJSON(
      `https://openlibrary.org/search.json?title=${searchQuery}&limit=${limit}`
    );
    if (!data || !data.docs || data.docs.length === 0) return [];

    const results = [];
    for (const doc of data.docs) {
      let coverUrl = null;
      if (doc.cover_i) {
        coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      } else if (doc.isbn && doc.isbn.length > 0) {
        coverUrl = `https://covers.openlibrary.org/b/isbn/${doc.isbn[doc.isbn.length - 1]}-L.jpg`;
      }
      if (coverUrl) {
        results.push({
          url: coverUrl,
          title: doc.title || title,
          author: (doc.author_name && doc.author_name[0]) || author || 'Desconocido',
          year: doc.first_publish_year ? String(doc.first_publish_year) : '',
        });
      }
    }
    return results;
  } catch (err) {
    console.error('⚠️ Open Library search error:', err.message);
    return [];
  }
}

// ---- SVG Placeholder Covers ----

const COVER_GRADIENTS = [
  ['#6d4c41', '#8d6e63'],
  ['#4e342e', '#795548'],
  ['#3e2723', '#6d4c41'],
  ['#5d4037', '#a1887f'],
  ['#455a64', '#78909c'],
  ['#00695c', '#4db6ac'],
  ['#e65100', '#ffb74d'],
  ['#283593', '#7986cb'],
  ['#6a1b9a', '#ba68c8'],
  ['#1565c0', '#64b5f6'],
];

const CATEGORY_ICONS = {
  'Ficción': '📚',
  'Ciencia': '🔬',
  'Historia': '🏛️',
  'Educación': '🎓',
  'Tecnología': '💻',
  'Arte': '🎨',
  'Filosofía': '🧠',
};

/**
 * Generate an SVG placeholder cover with book title, author, and category icon
 * @returns {string} SVG string
 */
function generatePlaceholderSVG(title, author, category, bookId) {
  const gradientIndex = bookId
    ? (typeof bookId === 'number' ? bookId : String(bookId).charCodeAt(0)) % COVER_GRADIENTS.length
    : Math.floor(Math.random() * COVER_GRADIENTS.length);
  const [color1, color2] = COVER_GRADIENTS[gradientIndex];
  const icon = CATEGORY_ICONS[category] || '📖';

  // Truncate title and author for display
  const displayTitle = (title || 'Sin título').slice(0, 60);
  const displayAuthor = (author || 'Desconocido').slice(0, 40);

  // Word wrap for title (max ~18 chars per line)
  const maxChars = 18;
  const words = displayTitle.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxChars && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  // Limit to 4 lines max
  const titleLines = lines.slice(0, 4);
  const titleY = 200 - (titleLines.length * 18);

  const titleSvg = titleLines.map((line, i) =>
    `<text x="200" y="${titleY + i * 36}" text-anchor="middle" fill="white" font-family="'Playfair Display', Georgia, serif" font-size="${titleLines.length > 3 ? 22 : 26}" font-weight="600">${_escapeXml(line)}</text>`
  ).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1}"/>
      <stop offset="100%" style="stop-color:${color2}"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="400" height="560" rx="16" fill="url(#bg)"/>
  <!-- Decorative top pattern -->
  <rect x="0" y="0" width="400" height="8" fill="rgba(255,255,255,0.1)"/>
  <rect x="20" y="30" width="360" height="1" fill="rgba(255,255,255,0.15)"/>
  <!-- Category icon -->
  <text x="200" y="120" text-anchor="middle" font-size="64" opacity="0.9">${icon}</text>
  <!-- Title -->
  <g filter="url(#shadow)">
    ${titleSvg}
  </g>
  <!-- Author -->
  <text x="200" y="${titleY + titleLines.length * 36 + 30}" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="'Inter', sans-serif" font-size="16" font-weight="400">${_escapeXml(displayAuthor)}</text>
  <!-- Bottom decorative line -->
  <rect x="120" y="480" width="160" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
  <!-- Library name -->
  <text x="200" y="520" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="'Inter', sans-serif" font-size="11" font-weight="500" letter-spacing="2">BIBLIOTECA COMUNITARIA</text>
</svg>`;
}

function _escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Save an SVG placeholder as a .svg file in uploads/
 * @returns {string} The relative path to the saved file
 */
function savePlaceholderCover(title, author, category, bookId) {
  const svg = generatePlaceholderSVG(title, author, category, bookId);

  // Try to save to disk
  try {
    // Ensure upload dir exists
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const filename = `cover-placeholder-${bookId || Date.now()}-${Math.round(Math.random() * 1e4)}.svg`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, svg, 'utf8');
    console.log('✅ Placeholder cover saved:', filename);
    return `/uploads/${filename}`;
  } catch (fileErr) {
    console.error('⚠️ Could not save SVG to disk:', fileErr.message);
    // Fallback: return a data URI so the browser can display it
    const encoded = Buffer.from(svg, 'utf8').toString('base64');
    const dataUri = `data:image/svg+xml;base64,${encoded}`;
    console.log('✅ Using data URI fallback for placeholder');
    return dataUri;
  }
}

/**
 * Download a remote cover image and save it locally
 * @param {string} url - Remote image URL
 * @param {string} prefix - Filename prefix (e.g., book id)
 * @returns {string|null} Local path or null on failure
 */
async function downloadCoverLocally(url, prefix) {
  try {
    const buffer = await _fetchBuffer(url);
    if (!buffer || buffer.length < 500) return null;

    const ext = url.includes('.png') ? '.png' : '.jpg';
    const filename = `${prefix || 'cover'}-${Date.now()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    console.log('✅ Cover downloaded:', filename, `(${(buffer.length / 1024).toFixed(1)} KB)`);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('⚠️ Error downloading cover:', err.message);
    return null;
  }
}

/**
 * Main function: Try to get a cover for a book
 * Priority: PDF/EPUB first page → Open Library → Placeholder SVG
 * @param {string} bookFileUrl - URL/path of the uploaded document file (for extraction)
 * @returns {string} Cover URL (local path, remote URL, or data URI)
 */
async function autoGenerateCover(title, author, category, bookId, bookFileUrl) {
  console.log(`🔍 Auto-generating cover for "${title}" by ${author}...`);
  console.log(`📁 Book file URL: ${bookFileUrl || '(none)'}`);

  // Priority 1: Extract first page/cover from the actual book file (local or remote)
  if (bookFileUrl && generateCoverFromFile) {
    try {
      const fileCover = await generateCoverFromFile(bookFileUrl);
      if (fileCover) {
        console.log('🖼️ Cover extracted from book file:', fileCover);
        return fileCover;
      }
    } catch (err) {
      console.error('⚠️ File cover extraction failed:', err.message);
    }
  }

  // Priority 2: Open Library API
  try {
    const olCover = await searchOpenLibraryCover(title, author);
    if (olCover) {
      console.log('📚 Found cover on Open Library:', olCover);
      return olCover;
    }
  } catch (err) {
    console.error('⚠️ Open Library search failed:', err.message);
  }

  // Priority 3: Placeholder SVG
  console.log('🎨 Generating placeholder cover for:', title);
  try {
    const placeholder = savePlaceholderCover(title, author, category, bookId);
    console.log('✅ Placeholder generated:', placeholder);
    return placeholder;
  } catch (err) {
    console.error('❌ Placeholder generation failed:', err.message);
    return null;
  }
}

/**
 * Extract a cover from a book's uploaded file
 * Priority: PDF/EPUB first page → Open Library → Placeholder
 * @param {object} book - Book object with file_url, title, author, category, id
 * @returns {string|null} Cover URL or null
 */
async function extractCoverFromBook(book) {
  const { title, author, category, id, file_url } = book;
  console.log(`🔍 extractCoverFromBook: "${title}" by ${author}`);
  console.log(`📁 file_url: ${file_url || '(none)'}`);

  // Priority 1: Extract first page/cover from the actual book file (local or remote)
  if (file_url && generateCoverFromFile) {
    try {
      const fileCover = await generateCoverFromFile(file_url);
      if (fileCover) {
        console.log('🖼️ Cover from book file:', fileCover);
        return fileCover;
      }
    } catch (err) {
      console.error('⚠️ File extraction error:', err.message);
    }
  }

  // Priority 2: Open Library
  try {
    const olCover = await searchOpenLibraryCover(title, author);
    if (olCover) {
      console.log('📚 Cover from Open Library:', olCover);
      return olCover;
    }
  } catch (err) {
    console.error('⚠️ Open Library error:', err.message);
  }

  // Priority 3: Placeholder SVG
  try {
    const placeholder = savePlaceholderCover(title, author, category, id);
    console.log('🎨 Placeholder cover:', placeholder);
    return placeholder;
  } catch (err) {
    console.error('❌ Placeholder error:', err.message);
  }

  return null;
}

module.exports = {
  searchOpenLibraryCover,
  getCoverByISBN,
  searchCovers,
  generatePlaceholderSVG,
  savePlaceholderCover,
  downloadCoverLocally,
  autoGenerateCover,
  extractCoverFromBook,
};
