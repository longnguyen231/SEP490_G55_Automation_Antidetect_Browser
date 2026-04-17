/**
 * GET  /api/admin/config  — read config
 * POST /api/admin/config  — update config (persists to .data/config.json)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../.data');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

const DEFAULTS = {
  proPriceVnd: parseInt(process.env.PRO_PRICE_VND || '299000', 10),
  maintenanceMode: false,
  maintenanceBanner: '',
  payosWebhookUrl: process.env.PAYOS_WEBHOOK_URL || '',
};

function readConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(readConfig());
  }

  if (req.method === 'POST') {
    const { proPriceVnd, maintenanceMode, maintenanceBanner } = req.body || {};
    const current = readConfig();
    const updated = {
      ...current,
      ...(proPriceVnd !== undefined && { proPriceVnd: Math.max(1000, parseInt(proPriceVnd, 10)) }),
      ...(maintenanceMode !== undefined && { maintenanceMode: Boolean(maintenanceMode) }),
      ...(maintenanceBanner !== undefined && { maintenanceBanner: String(maintenanceBanner).slice(0, 200) }),
      updatedAt: new Date().toISOString(),
      updatedBy: req.adminEmail,
    };
    saveConfig(updated);
    console.log(`[admin/config] updated by ${req.adminEmail}`, updated);
    return res.status(200).json(updated);
  }

  return res.status(405).end();
}
