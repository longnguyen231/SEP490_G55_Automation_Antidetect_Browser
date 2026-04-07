const fs = require('fs');
const { logPath } = require('../storage/paths');

function broadcastLog(profileId, line) {
  try {
    const { BrowserWindow } = require('electron');
    const level = /error|fail|exception/i.test(line) ? 'ERR' : /warn/i.test(line) ? 'WRN' : 'INF';
    const payload = { profileId, message: line, level, time: new Date().toISOString() };
    for (const w of BrowserWindow.getAllWindows()) {
      try { w.webContents.send('app-log', payload); } catch {}
    }
  } catch {}
}

function appendLog(profileId, line) {
  try {
    const entry = `[${new Date().toISOString()}] ${line}\n`;
    fs.appendFileSync(logPath(profileId), entry, 'utf8');
  } catch (e) {
    console.warn('appendLog failed:', e);
  }
  broadcastLog(profileId, line);
}

module.exports = { appendLog };
