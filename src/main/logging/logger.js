const fs = require('fs');
const { logPath } = require('../storage/paths');

function appendLog(profileId, line) {
  try {
    const entry = `[${new Date().toISOString()}] ${line}\n`;
    fs.appendFileSync(logPath(profileId), entry, 'utf8');
  } catch (e) {
    console.warn('appendLog failed:', e);
  }
}

module.exports = { appendLog };
