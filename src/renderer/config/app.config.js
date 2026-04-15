/**
 * App Configuration
 *
 * Central config for the renderer process.
 * Update WEB_ADMIN_URL when deploying to production.
 */

// URL of the web admin frontend
// Development: http://localhost:5174
// Production:  https://your-production-domain.com
export const WEB_ADMIN_URL = 'http://localhost:5174';

/**
 * Returns the URL for the license request page on the web admin.
 * @param {string} [tier] - Optional tier to pre-select (free/pro/enterprise)
 */
export function getLicenseRequestUrl(tier) {
  if (tier) {
    return `${WEB_ADMIN_URL}/license-request?tier=${tier}`;
  }
  return `${WEB_ADMIN_URL}/license-request`;
}

/**
 * Returns the URL for the user's license page on the web admin.
 */
export function getMyLicenseUrl() {
  return `${WEB_ADMIN_URL}/my-license`;
}

/**
 * Returns the pricing/landing page URL with anchor.
 */
export function getPricingUrl() {
  return `${WEB_ADMIN_URL}/#pricing`;
}
