#!/usr/bin/env node

/**
 * JWT License Token Generator
 * 
 * Simple script to generate test JWT tokens for development and testing.
 * 
 * Usage:
 *   node tools/generate-jwt.js --tier=pro --days=30
 *   node tools/generate-jwt.js --tier=enterprise --lifetime
 *   node tools/generate-jwt.js --tier=free --days=7 --maxProfiles=5
 */

const crypto = require('crypto');

// ========================================
// Configuration
// ========================================

// Secret key for signing (HS256)
// ⚠️ CHANGE THIS IN PRODUCTION!
const SECRET_KEY = 'HL-JWT-SECRET-KEY-SEP490-G55-2024-CHANGE-ME-IN-PRODUCTION';

// Preset tiers
const TIER_PRESETS = {
  free: {
    tier: 'free',
    maxProfiles: 5,
    features: [],
  },
  pro: {
    tier: 'pro',
    maxProfiles: -1,
    features: [
      'unlimited_profiles',
      'automation',
      'api_access',
      'priority_support',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    maxProfiles: -1,
    features: [
      'unlimited_profiles',
      'automation',
      'api_access',
      'priority_support',
      'custom_integrations',
      'white_label',
    ],
  },
};

// ========================================
// JWT Functions
// ========================================

/**
 * Base64 URL encode (JWT standard)
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate JWT token
 */
function generateJWT(payload, secret = SECRET_KEY) {
  // Header (HS256)
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Generate license payload
 */
function generateLicensePayload(options = {}) {
  const {
    tier = 'pro',
    maxProfiles = -1,
    features = null,
    days = null,
    lifetime = false,
    userId = null,
    email = null,
  } = options;

  const now = Math.floor(Date.now() / 1000);

  // Use preset or custom
  let tierData = TIER_PRESETS[tier] || {
    tier,
    maxProfiles,
    features: features || [],
  };

  // Override maxProfiles if specified
  if (maxProfiles !== null && maxProfiles !== undefined) {
    tierData.maxProfiles = maxProfiles;
  }

  // Override features if specified
  if (features !== null) {
    tierData.features = features;
  }

  const payload = {
    tier: tierData.tier,
    maxProfiles: tierData.maxProfiles,
    features: tierData.features,
    issuedAt: now,
    iat: now,
  };

  // Add expiry if not lifetime
  if (!lifetime && days) {
    payload.expiresAt = now + days * 24 * 60 * 60;
  }

  // Add optional fields
  if (userId) payload.userId = userId;
  if (email) payload.email = email;

  return payload;
}

// ========================================
// CLI Interface
// ========================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      if (value === undefined || value === 'true') {
        options[key] = true;
      } else if (value === 'false') {
        options[key] = false;
      } else if (!isNaN(value)) {
        options[key] = Number(value);
      } else {
        options[key] = value;
      }
    }
  });

  return options;
}

function printHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           JWT License Token Generator                         ║
╚═══════════════════════════════════════════════════════════════╝

Usage:
  node tools/generate-jwt.js [options]

Options:
  --tier=<tier>          License tier: free, pro, enterprise (default: pro)
  --days=<number>        License validity in days (default: 30)
  --lifetime             Generate lifetime license (no expiry)
  --maxProfiles=<num>    Max profiles limit (-1 = unlimited, default: from tier)
  --userId=<id>          Optional user ID
  --email=<email>        Optional user email
  --help                 Show this help message

Examples:
  # Pro license valid for 30 days
  node tools/generate-jwt.js --tier=pro --days=30

  # Enterprise lifetime license
  node tools/generate-jwt.js --tier=enterprise --lifetime

  # Free license valid for 7 days
  node tools/generate-jwt.js --tier=free --days=7

  # Custom: 10 profiles limit, 90 days
  node tools/generate-jwt.js --tier=pro --maxProfiles=10 --days=90

  # With user info
  node tools/generate-jwt.js --tier=pro --days=365 --userId=user_123 --email=user@example.com

Tier Presets:
  free        ➜ 5 profiles, no features
  pro         ➜ Unlimited profiles, automation, API access
  enterprise  ➜ Unlimited profiles, all features
  `);
}

// ========================================
// Main
// ========================================

function main() {
  const options = parseArgs();

  if (options.help || Object.keys(options).length === 0) {
    printHelp();
    return;
  }

  try {
    console.log('\n🔐 Generating JWT License Token...\n');

    // Generate payload
    const payload = generateLicensePayload(options);

    // Generate JWT
    const jwt = generateJWT(payload);

    // Display results
    console.log('─────────────────────────────────────────────────────────');
    console.log('📋 License Details:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  Tier:          ${payload.tier}`);
    console.log(`  Max Profiles:  ${payload.maxProfiles === -1 ? '∞ Unlimited' : payload.maxProfiles}`);
    console.log(`  Features:      ${payload.features.length > 0 ? payload.features.join(', ') : 'None'}`);
    console.log(`  Issued At:     ${new Date(payload.issuedAt * 1000).toLocaleString()}`);
    
    if (payload.expiresAt) {
      const expiryDate = new Date(payload.expiresAt * 1000);
      const daysValid = Math.ceil((payload.expiresAt - payload.issuedAt) / (24 * 60 * 60));
      console.log(`  Expires At:    ${expiryDate.toLocaleString()}`);
      console.log(`  Valid For:     ${daysValid} days`);
    } else {
      console.log(`  Expires At:    Never (Lifetime)`);
    }

    if (payload.userId) {
      console.log(`  User ID:       ${payload.userId}`);
    }
    if (payload.email) {
      console.log(`  Email:         ${payload.email}`);
    }

    console.log('\n─────────────────────────────────────────────────────────');
    console.log('🎟️  JWT Token:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(jwt);
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('📝 Payload (decoded):');
    console.log('─────────────────────────────────────────────────────────');
    console.log(JSON.stringify(payload, null, 2));
    console.log('─────────────────────────────────────────────────────────\n');

    console.log('✅ Token generated successfully!');
    console.log('💡 Copy the JWT token above and paste it into the app.\n');

  } catch (error) {
    console.error('\n❌ Error generating token:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateJWT,
  generateLicensePayload,
  TIER_PRESETS,
};
