/**
 * Public release endpoints (no auth).
 *
 *   GET /api/releases/latest          metadata for the newest release (?platform=windows to filter)
 *   GET /api/releases/:id/download    stream the binary to the client
 */
import { createReadStream } from 'fs';
import {
  findLatestRelease,
  findReleaseById,
  resolveReleaseFilePath,
  statReleaseFile,
} from './admin/releases.js';

function publicShape(r) {
  return {
    id: r.id,
    version: r.version,
    platform: r.platform,
    fileName: r.fileName,
    size: r.size,
    sha256: r.sha256,
    notes: r.notes,
    downloadUrl: r.downloadUrl,
    createdAt: r.createdAt,
  };
}

export function getLatestRelease(req, res) {
  const platform = req.query?.platform;
  const latest = findLatestRelease(platform);
  if (!latest) return res.status(404).json({ error: 'No releases published' });
  res.status(200).json(publicShape(latest));
}

export function downloadRelease(req, res) {
  const release = findReleaseById(req.params.id);
  if (!release) return res.status(404).json({ error: 'Release not found' });

  const stat = statReleaseFile(release);
  if (!stat) return res.status(410).json({ error: 'File is gone' });

  const filePath = resolveReleaseFilePath(release);
  res.setHeader('Content-Type', release.contentType || 'application/octet-stream');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(release.fileName)}"`,
  );
  res.setHeader('X-Release-Version', release.version || '');
  res.setHeader('X-Release-SHA256', release.sha256 || '');

  const stream = createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('[releases] stream error:', err?.message);
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err);
  });
  stream.pipe(res);
}
