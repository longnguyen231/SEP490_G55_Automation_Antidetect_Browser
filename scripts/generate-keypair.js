#!/usr/bin/env node
/**
 * Generate RSA Keypair for JWT License System
 * 
 * This script generates a 2048-bit RSA keypair:
 * - private.pem: For admin tool (sign JWTs) - KEEP SECRET!
 * - public.pem: For Electron app (verify JWTs) - Safe to embed in source
 * 
 * Usage:
 *   node scripts/generate-keypair.js
 * 
 * Output:
 *   - scripts/keys/private.pem
 *   - scripts/keys/public.pem
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

console.log('🔐 Generating RSA keypair for JWT license system...\n');

// Create keys directory if not exists
if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  console.log('✅ Created directory:', KEYS_DIR);
}

// Check if keys already exist
if (fs.existsSync(PRIVATE_KEY_PATH) || fs.existsSync(PUBLIC_KEY_PATH)) {
  console.log('⚠️  WARNING: Keys already exist!');
  console.log('   Private key:', PRIVATE_KEY_PATH);
  console.log('   Public key:', PUBLIC_KEY_PATH);
  console.log('\n🚨 Generating new keys will INVALIDATE all existing licenses!');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  // Wait 5 seconds before proceeding
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  (async () => {
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`   ${i}... `);
      await wait(1000);
    }
    console.log('\n');
    generateKeys();
  })();
} else {
  generateKeys();
}

function generateKeys() {
  try {
    // Generate 2048-bit RSA keypair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Write private key
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
    console.log('✅ Private key generated:', PRIVATE_KEY_PATH);

    // Write public key
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, 'utf8');
    console.log('✅ Public key generated:', PUBLIC_KEY_PATH);

    console.log('\n📝 Next steps:');
    console.log('   1. BACKUP private.pem to secure location (password manager, encrypted USB)');
    console.log('   2. Add to .gitignore: scripts/keys/*.pem');
    console.log('   3. Copy public.pem content to embed in licenseValidator.js');
    console.log('   4. Use private.pem in offline license generator tool');
    console.log('\n🔒 SECURITY:');
    console.log('   - NEVER commit private.pem to Git');
    console.log('   - NEVER upload private.pem to any server');
    console.log('   - Keep private.pem offline only (admin tool)');
    console.log('   - Public key is safe to embed in app source code');
    
    console.log('\n🎉 Keypair generation complete!\n');

    // Display public key for easy copy
    console.log('─'.repeat(70));
    console.log('PUBLIC KEY (copy to licenseValidator.js):');
    console.log('─'.repeat(70));
    console.log(publicKey);
    console.log('─'.repeat(70));

  } catch (error) {
    console.error('❌ Error generating keypair:', error.message);
    process.exit(1);
  }
}
