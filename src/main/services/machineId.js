const os = require('os');
const crypto = require('crypto');

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

function validateLicenseKey(inputKey) {
  try {
    const machineCode = getMachineCode();
    const expected = deriveLicenseKey(machineCode);
    const isValid = inputKey.trim().toUpperCase() === expected;
    
    // Save license status to file
    if (isValid) {
      try {
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron');
        const licensePath = path.join(app.getPath('userData'), 'license.json');
        fs.writeFileSync(licensePath, JSON.stringify({
          activated: true,
          key: inputKey.trim().toUpperCase(),
          activatedAt: new Date().toISOString()
        }), 'utf8');
      } catch (saveError) {
        console.error('Failed to save license file:', saveError);
      }
    }
    
    return {
      valid: isValid,
      expected, // expose so admin can generate keys
    };
  } catch {
    return { valid: false };
  }
}

module.exports = { getMachineCode, deriveLicenseKey, validateLicenseKey };
