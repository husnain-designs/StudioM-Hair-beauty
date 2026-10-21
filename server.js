const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

// Text-based types only — images/video/fonts are already compressed and
// gzipping them again just burns CPU for no size benefit.
const COMPRESSIBLE_TYPES = new Set([
  'text/html; charset=utf-8',
  'application/javascript; charset=utf-8',
  'text/jsx; charset=utf-8',
  'application/json; charset=utf-8',
  'text/css; charset=utf-8',
  'image/svg+xml',
  'text/plain; charset=utf-8'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.dc.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'text/jsx; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // Parse URL and normalize path
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/' || pathname === '') {
    pathname = '/StudioM-Home-v5.dc.html';
  }

  // Prevent path traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`404 Not Found: ${pathname}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Support range requests for video playback (.mp4)
    const range = req.headers.range;
    if (range && ext === '.mp4') {
      const totalSize = stats.size;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${totalSize}`
        });
        return res.end();
      }

      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      });
      stream.pipe(res);
      return;
    }

    const acceptEncoding = req.headers['accept-encoding'] || '';
    const canGzip = COMPRESSIBLE_TYPES.has(contentType) && /\bgzip\b/.test(acceptEncoding);

    if (canGzip) {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Vary': 'Accept-Encoding',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Studio M website running at:`);
  console.log(`  - Local:   http://localhost:${PORT}/`);
  console.log(`  - Home:    http://localhost:${PORT}/StudioM-Home-v5.dc.html`);
  console.log(`  - Services:http://localhost:${PORT}/StudioM-Services-v5.dc.html`);
  console.log(`  - Booking: http://localhost:${PORT}/StudioM-Booking.dc.html`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
