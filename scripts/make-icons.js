/*
  Generate derived icons from build/1.png:
  - Ensure public/1.png exists (copy from build/1.png if needed)
  - Generate public/favicon.ico from the PNG (for renderer/tab icon)
  - Optionally copy build/icon.png for compatibility
*/
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const pngToIco = require('png-to-ico');

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true }).catch(() => {});
}
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }

async function main() {
  const root = __dirname ? path.join(__dirname, '..') : process.cwd();
  const publicDir = path.join(root, 'public');
  const buildDir = path.join(root, 'build');
  await ensureDir(publicDir);
  await ensureDir(buildDir);

  const srcCandidates = [
    path.join(buildDir, '1.png'),
    path.join(publicDir, '1.png'),
  ];
  const src = srcCandidates.find(exists);
  if (!src) {
    console.warn('[icons] Source PNG not found. Please save your logo as build/1.png (preferred) or public/1.png.');
    return;
  }

  const publicPng = path.join(publicDir, '1.png');
  if (!exists(publicPng)) {
    await fsp.copyFile(src, publicPng).catch(()=>{});
    console.log('[icons] Copied ->', path.relative(root, publicPng));
  }

  const compatBuildPng = path.join(buildDir, 'icon.png');
  if (!exists(compatBuildPng)) {
    await fsp.copyFile(src, compatBuildPng).catch(()=>{});
    console.log('[icons] Copied ->', path.relative(root, compatBuildPng));
  }

  const faviconIco = path.join(publicDir, 'favicon.ico');
  try {
    const buf = await pngToIco(src);
    await fsp.writeFile(faviconIco, buf);
    console.log('[icons] Generated favicon ->', path.relative(root, faviconIco));
  } catch (e) {
    console.warn('[icons] Failed to generate favicon.ico:', e && e.message ? e.message : e);
  }
}

main().catch((e) => {
  console.error('[icons] Unexpected error:', e && e.message ? e.message : e);
  process.exitCode = 1;
});
