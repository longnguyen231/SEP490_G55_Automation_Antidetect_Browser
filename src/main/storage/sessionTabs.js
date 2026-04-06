/**
 * sessionTabs.js — Storage helper for saving and restoring open tabs.
 * 
 * Saves a list of URLs when a profile is closed so they can be reopened
 * on the next launch, providing a "Continue where you left off" experience.
 */

const fs = require('fs');
const path = require('path');
const { getDataRoot } = require('./paths');
const { appendLog } = require('../logging/logger');

/**
 * Get the path to the session-tabs.json file for a given profile.
 */
function getSessionTabsPath(profileId) {
  const dir = path.join(getDataRoot(), 'session-tabs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, `${profileId}.json`);
}

/**
 * Save an array of URLs for a profile.
 * 
 * @param {string} profileId - The profile ID.
 * @param {string[]} urls    - Array of URLs to save.
 */
function saveSessionTabs(profileId, urls) {
  try {
    if (!profileId) return;
    
    // Filter out blank pages or invalid URLs
    const validUrls = (urls || [])
      .filter(url => url && typeof url === 'string')
      .filter(url => !url.startsWith('chrome://') && !url.startsWith('edge://') && url !== 'about:blank' && url !== 'chrome-error://chromewebdata/');
      
    // Deduplicate consecutive identical URLs (optional, but good for messy rapid saves)
    const cleanUrls = [];
    for (const u of validUrls) {
      if (cleanUrls.length === 0 || cleanUrls[cleanUrls.length - 1] !== u) {
        cleanUrls.push(u);
      }
    }

    if (cleanUrls.length === 0) return; // Don't write empty states if not needed, or perhaps we DO want to clear it?
    // Actually, if they close the last tab, maybe we should clear the file.
    
    const filePath = getSessionTabsPath(profileId);
    fs.writeFileSync(filePath, JSON.stringify({ tabs: cleanUrls, timestamp: Date.now() }, null, 2));
  } catch (e) {
    appendLog(profileId, `Failed to save session tabs: ${e.message}`);
  }
}

/**
 * Clear the saved session tabs for a profile.
 */
function clearSessionTabs(profileId) {
  try {
    const filePath = getSessionTabsPath(profileId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    appendLog(profileId, `Failed to clear session tabs: ${e.message}`);
  }
}

/**
 * Load the saved URLs for a profile.
 * 
 * @param {string} profileId - The profile ID.
 * @returns {string[]} Array of URLs to restore.
 */
function loadSessionTabs(profileId) {
  try {
    const filePath = getSessionTabsPath(profileId);
    if (!fs.existsSync(filePath)) return [];
    
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.tabs)) {
      return parsed.tabs;
    }
    return [];
  } catch (e) {
    appendLog(profileId, `Failed to load session tabs: ${e.message}`);
    return [];
  }
}

module.exports = {
  getSessionTabsPath,
  saveSessionTabs,
  clearSessionTabs,
  loadSessionTabs
};
