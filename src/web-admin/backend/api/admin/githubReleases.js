/**
 * GitHub Releases management — list & publish các bản release trên repo feed
 * (XuanKien1/hlmck-releases) phục vụ auto-update của app desktop.
 *
 * Luồng (gate B):
 *   - GitHub Actions build xong → tạo release dạng DRAFT (chưa phát hành).
 *   - Admin vào web bấm "Publish" → endpoint này gọi GitHub API lật draft→latest.
 *   - App user poll feed → chỉ thấy release đã publish → hiện nút Update.
 *
 * Endpoints (admin):
 *   GET  /api/admin/github-releases             liệt kê release (kể cả draft)
 *   POST /api/admin/github-releases/:id/publish  phát hành 1 draft thành latest
 *
 * Env:
 *   GITHUB_RELEASES_TOKEN   PAT (scope: repo) của tài khoản sở hữu repo feed — BẮT BUỘC
 *   GITHUB_RELEASES_OWNER   mặc định: XuanKien1
 *   GITHUB_RELEASES_REPO    mặc định: hlmck-releases
 */

const OWNER = process.env.GITHUB_RELEASES_OWNER || 'XuanKien1';
const REPO = process.env.GITHUB_RELEASES_REPO || 'hlmck-releases';
const TOKEN = process.env.GITHUB_RELEASES_TOKEN || '';
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;

function ghHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'hlmck-web-admin',
  };
}

function publicShape(r) {
  return {
    id: r.id,
    name: r.name || r.tag_name,
    tagName: r.tag_name,
    draft: r.draft,
    prerelease: r.prerelease,
    htmlUrl: r.html_url,
    createdAt: r.created_at,
    publishedAt: r.published_at,
    assets: Array.isArray(r.assets)
      ? r.assets.map((a) => ({ name: a.name, size: a.size, downloadCount: a.download_count }))
      : [],
  };
}

export async function listGithubReleases(_req, res) {
  if (!TOKEN) {
    return res.status(503).json({ error: 'GITHUB_RELEASES_TOKEN chưa được cấu hình trên server' });
  }
  try {
    const ghRes = await fetch(`${API_BASE}/releases?per_page=30`, { headers: ghHeaders() });
    const body = await ghRes.json().catch(() => null);
    if (!ghRes.ok) {
      const msg = body?.message || `GitHub HTTP ${ghRes.status}`;
      return res.status(ghRes.status === 404 ? 404 : 502).json({ error: msg });
    }
    const releases = Array.isArray(body) ? body.map(publicShape) : [];
    res.status(200).json({ releases, owner: OWNER, repo: REPO });
  } catch (e) {
    console.error('[github-releases] list error:', e?.message);
    res.status(502).json({ error: e?.message || 'GitHub request failed' });
  }
}

export async function publishGithubRelease(req, res) {
  if (!TOKEN) {
    return res.status(503).json({ error: 'GITHUB_RELEASES_TOKEN chưa được cấu hình trên server' });
  }
  const id = String(req.params.id || '').replace(/[^\d]/g, '');
  if (!id) return res.status(400).json({ error: 'Invalid release id' });

  try {
    const ghRes = await fetch(`${API_BASE}/releases/${id}`, {
      method: 'PATCH',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: false, prerelease: false, make_latest: 'true' }),
    });
    const body = await ghRes.json().catch(() => null);
    if (!ghRes.ok) {
      const msg = body?.message || `GitHub HTTP ${ghRes.status}`;
      return res.status(502).json({ error: msg });
    }
    console.log(`[github-releases] published ${body?.tag_name || id} by ${req.adminEmail || 'admin'}`);
    res.status(200).json({ ok: true, release: publicShape(body) });
  } catch (e) {
    console.error('[github-releases] publish error:', e?.message);
    res.status(502).json({ error: e?.message || 'GitHub request failed' });
  }
}
