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
 * @param {string} [tier] - Optional tier to pre-select (free/pro)
 */
export function getLicenseRequestUrl(tier) {
  if (tier) {
    return `${WEB_ADMIN_URL}/license-request?tier=${tier}`;
  }
  return `${WEB_ADMIN_URL}/license-request`;
}

/**
 * Returns the pricing section URL on the landing page.
 */
export function getPricingUrl() {
  return `${WEB_ADMIN_URL}/#pricing`;
}

/**
 * Returns the checkout URL for upgrading to Pro.
 */
export function getCheckoutUrl() {
  return `${WEB_ADMIN_URL}/checkout?tier=pro`;
}
