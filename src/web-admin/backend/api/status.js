import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = join(__dirname, '../.data/config.json');

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const config = existsSync(CONFIG_FILE)
      ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
      : {};
    return res.status(200).json({
      maintenanceMode: Boolean(config.maintenanceMode),
      maintenanceBanner: config.maintenanceBanner || '',
    });
  } catch {
    return res.status(200).json({ maintenanceMode: false, maintenanceBanner: '' });
  }
}
