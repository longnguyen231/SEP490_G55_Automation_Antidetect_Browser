#!/usr/bin/env node
/**
 * Upload the freshly-built Electron installer to the web-admin backend.
 *
 * Runs automatically after `npm run dist`. Reads the electron-builder output
 * directory from package.json (build.directories.output, default: "release"),
 * picks the installer matching the current package.json version, and POSTs it
 * to the backend with multipart/form-data.
 *
 * Required env (either in process env or a .env file next to the script):
 *   RELEASE_UPLOAD_TOKEN  — shared secret accepted by the backend upload middleware
 *
 * Optional env:
 *   RELEASE_UPLOAD_URL    — upload endpoint (default: http://localhost:3001/api/admin/releases)
 *   RELEASE_NOTES         — release notes text
 *   RELEASE_PLATFORM      — override platform label (windows|macos|linux|portable)
 *   RELEASE_FILE          — explicit path to the file to upload (skips auto-discovery)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');

// Minimal .env loader — reads from a few candidate paths without pulling in a
// dotenv dependency. Existing process.env values always win.
function loadEnv(paths) {
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadEnv([
  path.join(ROOT, '.env'),
  path.join(ROOT, '.env.local'),
  path.join(ROOT, 'src', 'web-admin', '.env'),
  path.join(ROOT, 'src', 'web-admin', '.env.local'),
]);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version || '0.0.0';
const OUTPUT_DIR = path.resolve(ROOT, pkg.build?.directories?.output || 'release');

const UPLOAD_URL = process.env.RELEASE_UPLOAD_URL || 'http://localhost:3001/api/admin/releases';
const TOKEN = process.env.RELEASE_UPLOAD_TOKEN;
const NOTES = process.env.RELEASE_NOTES || '';
const PLATFORM_OVERRIDE = process.env.RELEASE_PLATFORM || '';
const EXPLICIT_FILE = process.env.RELEASE_FILE || '';

const EXT_TO_PLATFORM = { '.exe': 'windows', '.msi': 'windows', '.zip': 'portable', '.dmg': 'macos', '.appimage': 'linux', '.deb': 'linux', '.rpm': 'linux' };
const ALLOWED_EXT = new Set(Object.keys(EXT_TO_PLATFORM));

function fail(msg, code = 1) {
  console.error(`[upload-release] ${msg}`);
  process.exit(code);
}

function findInstaller() {
  if (EXPLICIT_FILE) {
    const p = path.resolve(EXPLICIT_FILE);
    if (!fs.existsSync(p)) fail(`RELEASE_FILE not found: ${p}`);
    return p;
  }
  if (!fs.existsSync(OUTPUT_DIR)) {
    fail(`Build output directory not found: ${OUTPUT_DIR}. Run the build first.`);
  }
  const candidates = fs.readdirSync(OUTPUT_DIR)
    .filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => ({ name: f, full: path.join(OUTPUT_DIR, f), stat: fs.statSync(path.join(OUTPUT_DIR, f)) }))
    .filter((c) => c.stat.isFile());

  if (candidates.length === 0) fail(`No installer artifacts found in ${OUTPUT_DIR} (looking for ${[...ALLOWED_EXT].join(', ')}).`);

  // Prefer filenames that contain the current version; break ties by newest mtime.
  candidates.sort((a, b) => {
    const av = a.name.includes(VERSION) ? 1 : 0;
    const bv = b.name.includes(VERSION) ? 1 : 0;
    if (av !== bv) return bv - av;
    return b.stat.mtimeMs - a.stat.mtimeMs;
  });
  return candidates[0].full;
}

function buildMultipart(filePath, fields) {
  const boundary = `----gsdUpload${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
  const CRLF = '\r\n';
  const fileName = path.basename(filePath);
  const fileStat = fs.statSync(filePath);

  const header = (name, value) =>
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`, 'utf8');

  const filePreamble = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
    `Content-Type: application/octet-stream${CRLF}${CRLF}`,
    'utf8',
  );
  const closingBoundary = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');

  const fieldBuffers = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => header(k, String(v)));

  const preLength = fieldBuffers.reduce((s, b) => s + b.length, 0) + filePreamble.length;
  const totalLength = preLength + fileStat.size + closingBoundary.length;

  return { boundary, preBuffers: [...fieldBuffers, filePreamble], closingBoundary, totalLength, fileSize: fileStat.size };
}

function upload(filePath, fields) {
  return new Promise((resolve, reject) => {
    const { boundary, preBuffers, closingBoundary, totalLength, fileSize } = buildMultipart(filePath, fields);
    const url = new URL(UPLOAD_URL);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength,
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
        } else {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch {}
          reject(new Error(`HTTP ${res.statusCode}: ${parsed?.error || data || 'upload failed'}`));
        }
      });
    });

    req.on('error', reject);

    // Write prefix fields + file header
    for (const buf of preBuffers) req.write(buf);

    // Stream the file with a simple progress indicator
    let uploaded = 0;
    let lastPct = -1;
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => {
      const ok = req.write(chunk);
      uploaded += chunk.length;
      const pct = Math.floor((uploaded / fileSize) * 100);
      if (pct !== lastPct && pct % 5 === 0) {
        process.stdout.write(`\r[upload-release] ${pct}%   `);
        lastPct = pct;
      }
      if (!ok) stream.pause();
    });
    req.on('drain', () => stream.resume());
    stream.on('end', () => {
      req.write(closingBoundary);
      req.end();
      process.stdout.write('\r[upload-release] 100%  \n');
    });
    stream.on('error', reject);
  });
}

async function main() {
  if (!TOKEN) fail('RELEASE_UPLOAD_TOKEN is not set. Add it to your env or skip this step.');

  const filePath = findInstaller();
  const ext = path.extname(filePath).toLowerCase();
  const platform = PLATFORM_OVERRIDE || EXT_TO_PLATFORM[ext] || 'unknown';

  const fileStat = fs.statSync(filePath);
  const mb = (fileStat.size / 1024 / 1024).toFixed(1);
  console.log(`[upload-release] ${path.relative(ROOT, filePath)} — ${mb} MB`);
  console.log(`[upload-release] version=${VERSION} platform=${platform} → ${UPLOAD_URL}`);

  const entry = await upload(filePath, { version: VERSION, notes: NOTES, platform });
  console.log(`[upload-release] OK — id=${entry.id} downloadUrl=${entry.downloadUrl}`);
}

main().catch((err) => fail(err.message || String(err)));
