/**
 * client-hints-utils.js — Generate correct Sec-CH-UA brands and Client Hints metadata.
 *
 * Chrome uses a specific algorithm to generate the "greased" brand string
 * in Sec-CH-UA headers. The brand permutation and "grease" values change
 * based on the Chrome major version. This module replicates that algorithm
 * so our spoofed headers match what a real Chrome instance would send.
 *
 * Used by both CDP engine (cdpOverrides.js) and Playwright engine (profiles.js).
 *
 * References:
 *   - Chromium source: components/embedder_support/user_agent_utils.cc
 *   - Spec: https://wicg.github.io/ua-client-hints/#grease
 */

// Greased brand strings used by Chrome — rotated based on major version
const GREASE_CHARS = [' ', '(', ')', '-', '.', '/', ':', ';', '=', '?', '_'];
const GREASE_VERSION_OPTIONS = ['8', '99', '24'];

/**
 * Generate the "greased" brand entry that Chrome adds to Sec-CH-UA.
 * Chrome picks a permutation based on `major % 8` for the brand order
 * and rotates the grease characters.
 *
 * @param {number} major - Chrome major version number
 * @returns {{ brand: string, version: string }}
 */
function generateGreaseBrand(major) {
  const seed = major;
  const charIdx1 = seed % GREASE_CHARS.length;
  const charIdx2 = (seed + 1) % GREASE_CHARS.length;
  const c1 = GREASE_CHARS[charIdx1];
  const c2 = GREASE_CHARS[charIdx2];
  const greaseVersion = GREASE_VERSION_OPTIONS[seed % GREASE_VERSION_OPTIONS.length];
  return {
    brand: `Not${c1}A${c2}Brand`,
    version: greaseVersion,
  };
}

/**
 * Generate the brands array for Sec-CH-UA header.
 * Order is permuted based on major version (Chrome rotates the 3 entries).
 *
 * @param {number} major - Chrome major version number
 * @returns {Array<{ brand: string, version: string }>}
 */
function generateBrands(major) {
  const grease = generateGreaseBrand(major);
  const chromium = { brand: 'Chromium', version: String(major) };
  const chrome = { brand: 'Google Chrome', version: String(major) };

  // Chrome permutes the order of [grease, chromium, chrome] based on major % 6
  const permutations = [
    [grease, chromium, chrome],
    [grease, chrome, chromium],
    [chromium, grease, chrome],
    [chromium, chrome, grease],
    [chrome, grease, chromium],
    [chrome, chromium, grease],
  ];
  return permutations[major % 6];
}

/**
 * Generate the fullVersionList array for Sec-CH-UA-Full-Version-List.
 *
 * @param {string} fullVersion - Full Chrome version string (e.g., "136.0.7103.93")
 * @returns {Array<{ brand: string, version: string }>}
 */
function generateFullVersionList(fullVersion) {
  const major = parseInt(fullVersion.split('.')[0], 10) || 136;
  const grease = generateGreaseBrand(major);
  const greaseFull = { brand: grease.brand, version: `${grease.version}.0.0.0` };
  const chromiumFull = { brand: 'Chromium', version: fullVersion };
  const chromeFull = { brand: 'Google Chrome', version: fullVersion };

  const permutations = [
    [greaseFull, chromiumFull, chromeFull],
    [greaseFull, chromeFull, chromiumFull],
    [chromiumFull, greaseFull, chromeFull],
    [chromiumFull, chromeFull, greaseFull],
    [chromeFull, greaseFull, chromiumFull],
    [chromeFull, chromiumFull, greaseFull],
  ];
  return permutations[major % 6];
}

/**
 * Generate the Sec-CH-UA header string value.
 *
 * @param {number} major - Chrome major version number
 * @returns {string} e.g., '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="24"'
 */
function generateSecChUaString(major) {
  return generateBrands(major)
    .map(b => `"${b.brand}";v="${b.version}"`)
    .join(', ');
}

/**
 * Resolve platform name from navigator.platform string.
 *
 * @param {string} platformStr - e.g., "Win32", "MacIntel", "Linux x86_64"
 * @returns {string} - "Windows", "macOS", or "Linux"
 */
function resolvePlatformName(platformStr) {
  if (!platformStr) return 'Windows';
  if (platformStr.includes('Mac')) return 'macOS';
  if (platformStr.includes('Linux')) return 'Linux';
  return 'Windows';
}

/**
 * Resolve platform version for Sec-CH-UA-Platform-Version.
 *
 * @param {string} platform - "Windows", "macOS", or "Linux"
 * @returns {string}
 */
function resolvePlatformVersion(platform) {
  switch (platform) {
    case 'Windows': return '15.0.0';
    case 'macOS': return '14.0.0';
    case 'Linux': return '6.5.0';
    default: return '15.0.0';
  }
}

/**
 * Build complete userAgentMetadata object for CDP Emulation.setUserAgentOverride.
 *
 * @param {string} fullVersion - e.g., "136.0.7103.93"
 * @param {string} platformStr - e.g., "Win32", "MacIntel"
 * @returns {Object} userAgentMetadata for CDP
 */
function buildUserAgentMetadata(fullVersion, platformStr) {
  const major = parseInt(fullVersion.split('.')[0], 10) || 136;
  const platform = resolvePlatformName(platformStr);
  const platformVersion = resolvePlatformVersion(platform);

  return {
    brands: generateBrands(major),
    fullVersionList: generateFullVersionList(fullVersion),
    fullVersion,
    platform,
    platformVersion,
    architecture: 'x86',
    model: '',
    mobile: false,
    bitness: '64',
    wow64: false,
  };
}

module.exports = {
  generateGreaseBrand,
  generateBrands,
  generateFullVersionList,
  generateSecChUaString,
  resolvePlatformName,
  resolvePlatformVersion,
  buildUserAgentMetadata,
};
