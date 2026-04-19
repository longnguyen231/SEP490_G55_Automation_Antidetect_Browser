/**
 * Release management — list / upload / delete Electron build artifacts.
 *
 * Storage layout:
 *   api/uploads/releases/<id>-<filename>   — the actual binary
 *   api/.data/releases.json                — metadata index
 *
 * Endpoints (all require admin or upload-token auth):
 *   GET    /api/admin/releases             list all releases, newest first
 *   POST   /api/admin/releases             multipart upload (field: file)
 *   DELETE /api/admin/releases/:id         remove metadata + file
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../.data');
const RELEASES_FILE = join(DATA_DIR, 'releases.json');
const UPLOAD_DIR = join(__dirname, '../../uploads/releases');

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_EXT = new Set(['.exe', '.zip', '.dmg', '.appimage', '.deb', '.rpm', '.msi']);
const PLATFORM_BY_EXT = {
  '.exe': 'windows',
  '.msi': 'windows',
  '.zip': 'portable',
  '.dmg': 'macos',
  '.appimage': 'linux',
  '.deb': 'linux',
  '.rpm': 'linux',
};

function ensureDirs() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

function loadReleases() {
  ensureDirs();
  try {
    if (!existsSync(RELEASES_FILE)) return [];
    const raw = JSON.parse(readFileSync(RELEASES_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveReleases(list) {
  ensureDirs();
  writeFileSync(RELEASES_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (c) => hash.update(c));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function newId() {
  return `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeFilename(name) {
  return String(name || 'build').replace(/[^\w.\-]+/g, '_').slice(0, 180);
}

// ── multer disk storage (streams large files to disk, not memory) ────────────
// Filename format: "<id>__<sanitized original>". The "__" separator keeps the
// id recoverable even when the original filename contains hyphens.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    ensureDirs();
    req._releaseId = newId();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safe = sanitizeFilename(file.originalname);
    cb(null, `${req._releaseId}__${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`Unsupported file type: ${ext || 'unknown'}`));
    }
    cb(null, true);
  },
});

export const uploadMiddleware = upload.single('file');

// ── Handlers ─────────────────────────────────────────────────────────────────

export function listReleases(_req, res) {
  const releases = loadReleases()
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.status(200).json({ releases });
}

export async function createRelease(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file (multipart field: file)' });
    }

    const ext = extname(req.file.originalname || '').toLowerCase();
    const version = String(req.body?.version || '').trim() || '0.0.0';
    const notes = String(req.body?.notes || '').trim().slice(0, 2000);
    const platform = String(req.body?.platform || '').trim() || PLATFORM_BY_EXT[ext] || 'unknown';

    const storedName = req.file.filename;
    const id = req._releaseId || (storedName.includes('__') ? storedName.split('__')[0] : newId());

    const filePath = req.file.path;
    const size = req.file.size;
    const sha256 = await sha256OfFile(filePath);

    const entry = {
      id,
      version,
      platform,
      fileName: req.file.originalname,
      storedName,
      size,
      sha256,
      notes,
      contentType: req.file.mimetype || 'application/octet-stream',
      downloadUrl: `/api/releases/${id}/download`,
      createdAt: new Date().toISOString(),
      uploadedBy: req.adminEmail || req.uploadTokenUser || null,
    };

    const all = loadReleases();
    all.push(entry);
    saveReleases(all);

    console.log(`[releases] uploaded ${entry.version} (${platform}) ${entry.fileName} — ${Math.round(size / 1024 / 1024)}MB by ${entry.uploadedBy}`);
    res.status(201).json(entry);
  } catch (err) {
    console.error('[releases] upload error:', err?.message);
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
}

export function deleteRelease(req, res) {
  const id = req.params.id;
  const all = loadReleases();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });

  const entry = all[idx];
  const filePath = join(UPLOAD_DIR, entry.storedName);
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch (e) {
    console.warn(`[releases] failed to remove file ${filePath}:`, e?.message);
  }
  all.splice(idx, 1);
  saveReleases(all);
  res.status(200).json({ ok: true, id });
}

// Shared helpers exported for the public download endpoint.
export function findReleaseById(id) {
  return loadReleases().find((r) => r.id === id) || null;
}

export function findLatestRelease(platform) {
  const all = loadReleases()
    .filter((r) => !platform || r.platform === platform)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return all[0] || null;
}

export function resolveReleaseFilePath(release) {
  return join(UPLOAD_DIR, release.storedName);
}

export function statReleaseFile(release) {
  try {
    return statSync(resolveReleaseFilePath(release));
  } catch {
    return null;
  }
}
