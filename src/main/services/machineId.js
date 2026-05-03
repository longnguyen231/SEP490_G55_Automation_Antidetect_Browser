const os = require('os');
const crypto = require('crypto');

// Web backend URL for license status sync (overridable at build time)
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://sep490-g55-automation-antidetect-browser.onrender.com';

function getMachineCode() {
  try {
    const networkInterfaces = os.networkInterfaces();
    let mac = '';

    // Attempt to find a stable MAC address
    const interfaces = Object.keys(networkInterfaces).sort();
    for (const iface of interfaces) {
        const infoArray = networkInterfaces[iface];
        if (!infoArray) continue;
        const info = infoArray.find(i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00');
        if (info && info.mac) {
            mac = info.mac;
            break;
        }
    }

    if (!mac) {
        for (const iface of interfaces) {
           const info = networkInterfaces[iface]?.[0];
           if (info && info.mac) {
               mac += info.mac + '-';
           }
        }
    }

    const cpus = os.cpus();
    const cpuInfo = cpus && cpus.length > 0 ? cpus[0].model : 'UnknownCPU';
    const totalMem = os.totalmem().toString();
    const platform = os.platform();
    const arch = os.arch();

    const rawStr = `${mac}-${cpuInfo}-${totalMem}-${platform}-${arch}`;

    const hash = crypto.createHash('sha256').update(rawStr).digest('hex').toUpperCase();

    // Format: XXXX XXXX XXXX XXXX (separated by space)
    return `${hash.slice(0, 4)} ${hash.slice(4, 8)} ${hash.slice(8, 12)} ${hash.slice(12, 16)}`;
  } catch (error) {
    console.error('Failed to generate machine code:', error);
    return 'XXXX XXXX XXXX XXXX';
  }
}

// ─── License Key ──────────────────────────────────────────────────────────────
// Key is derived from machine code + secret salt.
// Format: HL-XXXX-XXXX-XXXX (12 hex chars from SHA256)
const LICENSE_SECRET = 'HL-MCK-SEP490-G55-2024';

function deriveLicenseKey(machineCode) {
  const raw = machineCode.replace(/\s/g, '') + LICENSE_SECRET;
  const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  return `HL-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}

// ─── Server sync ──────────────────────────────────────────────────────────────
// Fetch license metadata from web server. Returns null when offline.
async function fetchLicenseMeta(machineCode) {
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/verify-machine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineCode }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // offline — graceful fallback
  }
}

async function validateLicenseKey(inputKey) {
  try {
    const machineCode = getMachineCode();
    const expected = deriveLicenseKey(machineCode);
    const isValid = inputKey.trim().toUpperCase() === expected;

    if (isValid) {
      // Check server: reject if revoked; re-bind if machine was deactivated
      const meta = await fetchLicenseMeta(machineCode);
      if (meta && meta.status === 'revoked') {
        return { valid: false };
      }
      if (!meta || meta.status === 'not_found') {
        // Machine was deactivated — re-register on server (best-effort)
        try {
          await fetch(`${LICENSE_SERVER_URL}/api/reactivate-machine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: inputKey.trim().toUpperCase(), machineCode }),
            signal: AbortSignal.timeout(5000),
          });
        } catch { /* offline — ok */ }
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron');
        const licensePath = path.join(app.getPath('userData'), 'license.json');
        fs.writeFileSync(licensePath, JSON.stringify({
          activated: true,
          key: inputKey.trim().toUpperCase(),
          activatedAt: new Date().toISOString(),
          // Store trial expiry if server provided it (null for paid licenses)
          expiresAt: meta?.expiresAt || null,
        }), 'utf8');
      } catch (saveError) {
        console.error('Failed to save license file:', saveError);
      }
    }

    return { valid: isValid };
  } catch {
    return { valid: false };
  }
}

async function deactivateLicense() {
  try {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    if (fs.existsSync(licensePath)) {
      // Notify server to clear machine binding (best-effort, ignore if offline)
      try {
        await fetch(`${LICENSE_SERVER_URL}/api/deactivate-machine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machineCode: getMachineCode() }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // offline — local file is still removed; admin will see it deactivated on next sync
      }
      fs.unlinkSync(licensePath);
    }
    return { success: true };
  } catch (err) {
    console.error('Failed to deactivate license:', err);
    return { success: false, error: err.message };
  }
}

// Called on app startup — syncs revocation status and refreshes trial expiry.
// Non-blocking: if offline, existing license.json is kept as-is.
async function syncLicenseStatus() {
  try {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    if (!fs.existsSync(licensePath)) return;

    const machineCode = getMachineCode();
    const meta = await fetchLicenseMeta(machineCode);
    if (!meta) return; // offline — keep existing state

    if (meta.status === 'revoked') {
      fs.unlinkSync(licensePath);
      console.log('[license] License revoked by admin — cleared local license.json');
      return;
    }

    // Refresh trial expiry date in case admin extended it
    if (meta.expiresAt) {
      const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
      fs.writeFileSync(licensePath, JSON.stringify({
        ...licenseData,
        expiresAt: meta.expiresAt,
      }), 'utf8');
    }
  } catch (err) {
    console.error('[license] syncLicenseStatus error:', err.message);
  }
}

module.exports = { getMachineCode, deriveLicenseKey, validateLicenseKey, deactivateLicense, syncLicenseStatus };
