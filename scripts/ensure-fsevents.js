// Ensure missing optional dependency folders exist to appease packagers on Windows
const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

try {
  const base = path.resolve(__dirname, '..');
  const fseventsPath = path.join(base, 'node_modules', 'playwright', 'node_modules', 'fsevents');
  if (!fs.existsSync(fseventsPath)) {
    ensureDir(fseventsPath);
    try { fs.writeFileSync(path.join(fseventsPath, '.placeholder'), ''); } catch {}
    console.log('[ensure-fsevents] Created placeholder:', fseventsPath);
  } else {
    console.log('[ensure-fsevents] Exists:', fseventsPath);
  }
} catch (e) {
  console.warn('[ensure-fsevents] Warning:', e && e.message);
}
