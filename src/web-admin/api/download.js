/**
 * GET /api/download/:platform  — redirect to download URL + track count
 * GET /api/download/stats       — return download stats (public)
 *
 * Platforms: windows | portable | linux | macos
 *
 * URLs configured via .data/config.json → downloadUrls
 * Falls back to GitHub Releases if not configured.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../.data');
const DOWNLOADS_FILE = join(DATA_DIR, 'downloads.json');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

const GITHUB_BASE = 'https://github.com/OngBanTat/ObtAutomationAntidetectBrowser/releases/latest/download';

const DEFAULT_URLS = {
  windows: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.Setup.exe`,
  portable: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.Portable.zip`,
  linux: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.AppImage`,
  macos: `${GITHUB_BASE}/HL-MCK.Antidetect.Browser.dmg`,
};

function getConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return {}; }
}

function loadDownloads() {
  try {
    if (!existsSync(DOWNLOADS_FILE)) return {};
    return JSON.parse(readFileSync(DOWNLOADS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveDownloads(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DOWNLOADS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function downloadRedirect(req, res) {
  const platform = req.params.platform?.toLowerCase();

  if (platform === 'stats') {
    // Return download stats
    const counts = loadDownloads();
    const total = Object.values(counts).reduce((s, c) => s + (c.count || 0), 0);
    return res.status(200).json({ total, platforms: counts });
  }

  const config = getConfig();
  const urls = { ...DEFAULT_URLS, ...(config.downloadUrls || {}) };
  const url = urls[platform];

  if (!url) {
    return res.status(404).json({ error: `Unknown platform: ${platform}. Use: ${Object.keys(DEFAULT_URLS).join(', ')}` });
  }

  // Track download
  try {
    const counts = loadDownloads();
    if (!counts[platform]) counts[platform] = { count: 0, lastAt: null };
    counts[platform].count += 1;
    counts[platform].lastAt = new Date().toISOString();
    // Record daily stats for chart
    const today = new Date().toISOString().slice(0, 10);
    if (!counts[platform].daily) counts[platform].daily = {};
    counts[platform].daily[today] = (counts[platform].daily[today] || 0) + 1;
    saveDownloads(counts);
  } catch (e) {
    console.error('[download] tracking error:', e.message);
  }

  // Redirect to actual file
  return res.redirect(302, url);
}

export function downloadStats(req, res) {
  const counts = loadDownloads();
  const total = Object.values(counts).reduce((s, c) => s + (c.count || 0), 0);
  return res.status(200).json({ total, platforms: counts });
}
