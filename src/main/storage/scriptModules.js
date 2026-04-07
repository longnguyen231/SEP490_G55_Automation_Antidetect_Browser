/**
 * scriptModules.js — Manage user-installed npm packages for automation scripts.
 * Packages are installed into a dedicated directory: {dataRoot}/script-modules/
 * Scripts can then use require('package-name') inside the sandbox.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { getDataRoot } = require('./paths');
const { appendLog } = require('../logging/logger');

function getModulesDir() {
  const dir = path.join(getDataRoot(), 'script-modules');
  fs.mkdirSync(dir, { recursive: true });
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'script-modules', version: '1.0.0', private: true, dependencies: {} }, null, 2));
  }
  return dir;
}

function listModules() {
  try {
    const dir = getModulesDir();
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const deps = pkg.dependencies || {};
    return Object.entries(deps).map(([name, version]) => ({
      name,
      version: version.replace(/^[\^~]/, ''),
    }));
  } catch (e) {
    appendLog('system', `scriptModules listModules error: ${e.message}`);
    return [];
  }
}

function runNpm(args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn('npm', args, {
      cwd,
      shell: true,
      timeout: 120000,
      env: { ...process.env, NODE_ENV: 'production' },
    });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', (e) => resolve({ ok: false, error: e.message }));
    proc.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: stderr.slice(0, 500) || `npm exited with code ${code}` });
    });
  });
}

function installModule(packageName) {
  return new Promise(async (resolve) => {
    try {
      if (!packageName || typeof packageName !== 'string' || !/^[@a-zA-Z0-9._\-/]+(@[\w.\-]+)?$/.test(packageName.trim())) {
        return resolve({ success: false, error: 'Invalid package name' });
      }
      const dir = getModulesDir();
      appendLog('system', `Script modules: installing "${packageName}"...`);
      const result = await runNpm(['install', '--save', packageName.trim()], dir);
      if (result.ok) {
        appendLog('system', `Script modules: "${packageName}" installed OK`);
        resolve({ success: true, modules: listModules() });
      } else {
        appendLog('system', `Script modules: install "${packageName}" failed — ${result.error}`);
        resolve({ success: false, error: result.error });
      }
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

function uninstallModule(packageName) {
  return new Promise(async (resolve) => {
    try {
      const dir = getModulesDir();
      appendLog('system', `Script modules: uninstalling "${packageName}"...`);
      const result = await runNpm(['uninstall', packageName.trim()], dir);
      if (result.ok) {
        appendLog('system', `Script modules: "${packageName}" uninstalled OK`);
        resolve({ success: true, modules: listModules() });
      } else {
        appendLog('system', `Script modules: uninstall "${packageName}" failed — ${result.error}`);
        resolve({ success: false, error: result.error });
      }
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

module.exports = { getModulesDir, listModules, installModule, uninstallModule };
