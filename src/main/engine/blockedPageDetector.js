/**
 * blockedPageDetector.js — Detects Cloudflare challenges, CAPTCHAs, and block pages.
 *
 * Anti-bot services (Cloudflare, DataDome, PerimeterX, hCaptcha, reCAPTCHA)
 * serve challenge pages when they suspect automation. This module:
 *
 *   1. Detects known block/challenge patterns in page content
 *   2. Automatically waits for Cloudflare challenges to resolve (they often
 *      auto-solve within 5-10 seconds if the fingerprint is good enough)
 *   3. Optionally retries navigation if a block is detected
 *   4. Logs detection events for debugging
 *
 * Detection is purely passive (reading page content) — it does NOT attempt
 * to solve CAPTCHAs, which would require external solver services.
 */

const { appendLog } = require('../logging/logger');

// ═══════════════════════════════════════════════════════════════════════
// DETECTION PATTERNS
// Each pattern includes: name, detection method, and whether it's
// an auto-solvable challenge or a hard block.
// ═══════════════════════════════════════════════════════════════════════

const BLOCK_PATTERNS = [
  {
    name: 'Cloudflare Challenge (Turnstile)',
    // Cloudflare's "checking your browser" interstitial
    detect: (content, title) =>
      title.includes('Just a moment') ||
      content.includes('cf-browser-verification') ||
      content.includes('cf_chl_opt') ||
      content.includes('challenges.cloudflare.com') ||
      content.includes('_cf_chl_tk'),
    autoResolvable: true,
    waitTimeMs: 15000, // Cloudflare challenges often auto-solve in 5-15s
  },
  {
    name: 'Cloudflare Block (403/1020)',
    detect: (content, title) =>
      (content.includes('cf-error-code') && content.includes('1020')) ||
      (title.includes('Access denied') && content.includes('cloudflare')),
    autoResolvable: false,
  },
  {
    name: 'Cloudflare Rate Limit (1015)',
    detect: (content, title) =>
      content.includes('cf-error-code') && content.includes('1015'),
    autoResolvable: false,
  },
  {
    name: 'DataDome Challenge',
    detect: (content, title) =>
      content.includes('datadome') ||
      content.includes('dd.js') ||
      (content.includes('geo.captcha-delivery.com')),
    autoResolvable: false,
  },
  {
    name: 'PerimeterX Challenge',
    detect: (content, title) =>
      content.includes('perimeterx') ||
      content.includes('_pxhd') ||
      content.includes('px-captcha'),
    autoResolvable: false,
  },
  {
    name: 'hCaptcha',
    detect: (content, title) =>
      content.includes('hcaptcha.com') ||
      content.includes('h-captcha'),
    autoResolvable: false,
  },
  {
    name: 'reCAPTCHA',
    detect: (content, title) =>
      content.includes('recaptcha') ||
      content.includes('google.com/recaptcha'),
    autoResolvable: false,
  },
  {
    name: 'Generic Bot Block',
    detect: (content, title) =>
      title.includes('Access Denied') ||
      title.includes('Blocked') ||
      title.includes('Robot Check') ||
      content.includes('automated access') ||
      content.includes('bot detected') ||
      content.includes('unusual traffic'),
    autoResolvable: false,
  },
];

/**
 * Check if a page is showing a block/challenge page.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{blocked: boolean, pattern: string|null, autoResolvable: boolean, waitTimeMs: number}>}
 */
async function detectBlockedPage(page) {
  try {
    const title = await page.title().catch(() => '');
    const content = await page.content().catch(() => '');
    const contentLower = content.toLowerCase();
    const titleLower = title.toLowerCase();

    for (const pattern of BLOCK_PATTERNS) {
      if (pattern.detect(contentLower, titleLower)) {
        return {
          blocked: true,
          pattern: pattern.name,
          autoResolvable: pattern.autoResolvable,
          waitTimeMs: pattern.waitTimeMs || 0,
        };
      }
    }

    // Check HTTP status via page response (if available)
    // 403, 429, 503 with challenge content are suspicious
    try {
      const url = page.url();
      // If the URL contains a challenge path, it's likely blocked
      if (url.includes('/cdn-cgi/challenge') || url.includes('/challenge')) {
        return {
          blocked: true,
          pattern: 'Challenge URL redirect',
          autoResolvable: true,
          waitTimeMs: 10000,
        };
      }
    } catch {}

    return { blocked: false, pattern: null, autoResolvable: false, waitTimeMs: 0 };
  } catch {
    return { blocked: false, pattern: null, autoResolvable: false, waitTimeMs: 0 };
  }
}

/**
 * Wait for a Cloudflare-type challenge to auto-resolve.
 * Polls the page periodically to check if the challenge has cleared.
 *
 * @param {import('playwright').Page} page
 * @param {string} profileId - For logging
 * @param {number} [maxWaitMs=20000] - Maximum time to wait
 * @returns {Promise<boolean>} true if challenge resolved, false if still blocked
 */
async function waitForChallengeResolve(page, profileId, maxWaitMs = 20000) {
  const startTime = Date.now();
  const pollInterval = 2000;

  appendLog(profileId, `Waiting for challenge to auto-resolve (max ${maxWaitMs / 1000}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));

    const detection = await detectBlockedPage(page);
    if (!detection.blocked) {
      appendLog(profileId, 'Challenge resolved successfully');
      return true;
    }

    // Check if the page URL has changed (redirect after solving)
    try {
      const url = page.url();
      if (!url.includes('/challenge') && !url.includes('cdn-cgi')) {
        const recheck = await detectBlockedPage(page);
        if (!recheck.blocked) {
          appendLog(profileId, 'Challenge resolved (page redirected)');
          return true;
        }
      }
    } catch {}
  }

  appendLog(profileId, 'Challenge did not auto-resolve within timeout');
  return false;
}

/**
 * Navigate to a URL with automatic blocked-page detection and retry.
 *
 * Flow:
 *   1. Navigate to URL
 *   2. Check for block/challenge patterns
 *   3. If Cloudflare challenge detected → wait for auto-resolve
 *   4. If hard block detected → retry with delays (up to maxRetries)
 *   5. Return result with detection details
 *
 * @param {import('playwright').Page} page
 * @param {string} url - URL to navigate to
 * @param {string} profileId - For logging
 * @param {Object} [opts]
 * @param {number} [opts.maxRetries=2] - Maximum retry attempts
 * @param {number} [opts.retryDelayMs=5000] - Delay between retries
 * @param {string} [opts.waitUntil='domcontentloaded'] - Navigation wait condition
 * @param {number} [opts.timeout=30000] - Navigation timeout
 * @returns {Promise<{success: boolean, blocked: boolean, pattern: string|null, retries: number}>}
 */
async function navigateWithRetry(page, url, profileId, opts = {}) {
  const maxRetries = opts.maxRetries ?? 2;
  const retryDelayMs = opts.retryDelayMs || 5000;
  const waitUntil = opts.waitUntil || 'domcontentloaded';
  const timeout = opts.timeout || 30000;

  let lastPattern = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        appendLog(profileId, `Retry ${attempt}/${maxRetries} for ${url}`);
        // Progressive backoff: each retry waits longer
        await new Promise(r => setTimeout(r, retryDelayMs * attempt));
      }

      await page.goto(url, { waitUntil, timeout });

      // Brief wait for page to settle (some challenges load async)
      await new Promise(r => setTimeout(r, 1500));

      const detection = await detectBlockedPage(page);

      if (!detection.blocked) {
        if (attempt > 0) {
          appendLog(profileId, `Successfully loaded ${url} on attempt ${attempt + 1}`);
        }
        return { success: true, blocked: false, pattern: null, retries: attempt };
      }

      lastPattern = detection.pattern;
      appendLog(profileId, `Detected: ${detection.pattern} on ${url}`);

      // If it's an auto-resolvable challenge (like Cloudflare Turnstile),
      // wait for it to resolve before counting it as a failed attempt
      if (detection.autoResolvable) {
        const resolved = await waitForChallengeResolve(
          page, profileId, detection.waitTimeMs || 15000
        );
        if (resolved) {
          return { success: true, blocked: false, pattern: detection.pattern, retries: attempt };
        }
      }

      // If this was the last attempt, don't wait for retry
      if (attempt === maxRetries) break;

    } catch (e) {
      appendLog(profileId, `Navigation error on attempt ${attempt + 1}: ${e?.message || e}`);
      if (attempt === maxRetries) break;
    }
  }

  appendLog(profileId, `All ${maxRetries + 1} attempts failed for ${url}. Last detection: ${lastPattern}`);
  return { success: false, blocked: true, pattern: lastPattern, retries: maxRetries };
}

/**
 * Install a page-level listener that automatically detects blocked pages
 * after every navigation. Useful for monitoring during a session.
 *
 * @param {import('playwright').Page} page
 * @param {string} profileId
 * @param {Function} [onBlocked] - Callback when a block is detected
 */
function installBlockDetector(page, profileId, onBlocked) {
  page.on('load', async () => {
    try {
      // Small delay to let challenge scripts initialize
      await new Promise(r => setTimeout(r, 2000));
      const detection = await detectBlockedPage(page);
      if (detection.blocked) {
        appendLog(profileId, `[Auto-detect] Blocked page: ${detection.pattern} at ${page.url()}`);
        if (onBlocked) onBlocked(detection, page);

        // If auto-resolvable, try to wait it out silently
        if (detection.autoResolvable) {
          await waitForChallengeResolve(page, profileId, detection.waitTimeMs || 15000);
        }
      }
    } catch {}
  });
}

module.exports = {
  detectBlockedPage,
  waitForChallengeResolve,
  navigateWithRetry,
  installBlockDetector,
  BLOCK_PATTERNS,
};
