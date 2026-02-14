// Electron Builder afterPack hook to obfuscate all JavaScript under src/main and src/preload.
// Works with both asar=false (plain files in app dir) and asar=true (resources/app.asar).
// Requires devDependencies: javascript-obfuscator, @electron/asar (or asar)

const { obfuscate } = require('javascript-obfuscator');
let asar;
try {
  // Preferred modern package name
  asar = require('@electron/asar');
} catch (e1) {
  try {
    // Fallback to legacy name if available
    asar = require('asar');
  } catch (e2) {
    console.warn('[afterPack-obfuscate] asar module not found. Skipping asar processing.');
  }
}
const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = ['node_modules', 'vendor'];

function shouldProcess(filePath) {
  if (!filePath.endsWith('.js')) return false;
  return !EXCLUDE_DIRS.some(ex => filePath.includes(path.sep + ex + path.sep));
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...walk(p));
    else if (stat.isFile() && shouldProcess(p)) out.push(p);
  }
  return out;
}

function obfuscateFile(absPath) {
  try {
    const code = fs.readFileSync(absPath, 'utf8');
    const result = obfuscate(code, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: false,
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: false,
      stringArray: true,
      stringArrayEncoding: ['rc4'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      transformObjectKeys: false,
      unicodeEscapeSequence: false,
    });
    fs.writeFileSync(absPath, result.getObfuscatedCode(), 'utf8');
    console.log('[afterPack-obfuscate] Obfuscated', path.relative(process.cwd(), absPath));
  } catch (e) {
    console.warn('[afterPack-obfuscate] Failed', absPath, e.message);
  }
}

function obfuscateTree(rootDir) {
  const mainDir = path.join(rootDir, 'src', 'main');
  const preloadDir = path.join(rootDir, 'src', 'preload');
  const files = [...walk(mainDir), ...walk(preloadDir)];
  if (files.length === 0) {
    console.warn('[afterPack-obfuscate] No JS files found under', mainDir, 'or', preloadDir);
  }
  for (const f of files) obfuscateFile(f);
  console.log(`[afterPack-obfuscate] Obfuscated ${files.length} file(s).`);
}

exports.default = async function afterPackHook(context) {
  const appOutDir = context.appOutDir; // e.g. release/win-unpacked
  const resourcesDir = path.join(appOutDir, 'resources');
  const asarPath = path.join(resourcesDir, 'app.asar');

  if (fs.existsSync(asarPath)) {
    // asar=true path: extract, obfuscate, and repack
    const tmpDir = path.join(appOutDir, '__obf_tmp');
    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });
      console.log('[afterPack-obfuscate] Extracting asar to', tmpDir);
      asar.extractAll(asarPath, tmpDir);

      obfuscateTree(tmpDir);

      const backup = asarPath + '.bak';
      try { fs.renameSync(asarPath, backup); } catch (_) {}
      console.log('[afterPack-obfuscate] Repacking asar');
      await asar.createPackage(tmpDir, asarPath);
      try { fs.rmSync(backup, { force: true }); } catch (_) {}
    } catch (e) {
      console.warn('[afterPack-obfuscate] asar processing failed:', e.message);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  } else {
    // asar=false path: obfuscate in-place
    obfuscateTree(appOutDir);
  }
};
