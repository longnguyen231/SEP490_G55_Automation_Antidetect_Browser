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
 * Returns the URL for the "Get My License Key" page on the web admin.
 */
export function getLicenseRequestUrl() {
  return `${WEB_ADMIN_URL}/my-license`;
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
