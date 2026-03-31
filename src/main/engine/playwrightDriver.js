/**
 * playwrightDriver.js
 * Single source of truth for Playwright imports.
 * Rebrowser-playwright patches navigator.webdriver and other bot signals.
 */

let pw;
try {
  // Try loading explicitly installed rebrowser-playwright
  pw = require('rebrowser-playwright');
} catch {
  // Fallback to playwright if alias is used or standard one installed
  pw = require('playwright');
}

module.exports = pw;
