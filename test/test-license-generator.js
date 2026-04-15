/**
 * Offline License Generator Test
 * Simulates JWT generation like the HTML tool does
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { verifyJwtLicense } = require('../src/main/services/licenseValidator');
const { getMachineCode } = require('../src/main/services/machineId');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║      OFFLINE LICENSE GENERATOR TEST                        ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Load private key
const privateKeyPath = path.join(__dirname, '../scripts/keys/private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ Error: private.pem not found!');
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
console.log('✅ Private key loaded from:', privateKeyPath);
console.log(`   Size: ${privateKey.length} bytes\n`);

// Get machine code
const machineCode = getMachineCode();
console.log(`📌 Current Machine Code: ${machineCode}\n`);

// ═══════════════════════════════════════════════════════════════════════
// Test 1: Generate Pro License (1 Year)
// ═══════════════════════════════════════════════════════════════════════
console.log('─'.repeat(60));
console.log('🧪 Test 1: Generate Pro License (1 Year Duration)');
console.log('─'.repeat(60));

const now = Math.floor(Date.now() / 1000);
const oneYear = 365 * 24 * 60 * 60;

const proPayload = {
  machineCode: machineCode,
  tier: 'pro',
  maxProfiles: -1,
  features: ['unlimited_profiles', 'automation', 'team_sharing'],
  issuedAt: now,
  expiresAt: now + oneYear
};

console.log('\n📝 Payload:');
console.log(JSON.stringify(proPayload, null, 2));

try {
  const proJWT = jwt.sign(proPayload, privateKey, { algorithm: 'RS256' });
  console.log('\n✅ JWT Generated Successfully!');
  console.log(`   Length: ${proJWT.length} characters`);
  console.log(`   First 100 chars: ${proJWT.substring(0, 100)}...`);
  console.log(`   Last 50 chars: ...${proJWT.substring(proJWT.length - 50)}`);
  
  // Verify JWT immediately
  console.log('\n🔍 Verifying generated JWT...');
  const verifyResult = verifyJwtLicense(proJWT);
  
  if (verifyResult.valid) {
    console.log('✅ JWT Verification: PASS');
    console.log(`   Tier: ${verifyResult.payload.tier}`);
    console.log(`   Max Profiles: ${verifyResult.payload.maxProfiles}`);
    console.log(`   Features: ${verifyResult.payload.features.join(', ')}`);
    const expiresDate = new Date(verifyResult.payload.expiresAt * 1000);
    console.log(`   Expires: ${expiresDate.toLocaleDateString('vi-VN')} (${Math.floor((verifyResult.payload.expiresAt - now) / 86400)} days)`);
    
    // Save to file for manual testing
    const outputPath = path.join(__dirname, '../data/test-license-pro-1year.jwt');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, proJWT, 'utf8');
    console.log(`\n💾 JWT saved to: ${outputPath}`);
    console.log('   You can paste this into Electron app to activate!');
  } else {
    console.log('❌ JWT Verification: FAIL');
    console.log(`   Error: ${verifyResult.error}`);
  }
  
} catch (error) {
  console.log('❌ JWT Generation Failed:', error.message);
}

// ═══════════════════════════════════════════════════════════════════════
// Test 2: Generate Free License (30 Days)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n\n' + '─'.repeat(60));
console.log('🧪 Test 2: Generate Free License (30 Days Duration)');
console.log('─'.repeat(60));

const thirtyDays = 30 * 24 * 60 * 60;

const freePayload = {
  machineCode: machineCode,
  tier: 'free',
  maxProfiles: 5,
  features: [],
  issuedAt: now,
  expiresAt: now + thirtyDays
};

console.log('\n📝 Payload:');
console.log(JSON.stringify(freePayload, null, 2));

try {
  const freeJWT = jwt.sign(freePayload, privateKey, { algorithm: 'RS256' });
  console.log('\n✅ JWT Generated Successfully!');
  console.log(`   Length: ${freeJWT.length} characters`);
  
  // Verify
  const verifyResult = verifyJwtLicense(freeJWT);
  
  if (verifyResult.valid) {
    console.log('✅ JWT Verification: PASS');
    console.log(`   Tier: ${verifyResult.payload.tier}`);
    console.log(`   Max Profiles: ${verifyResult.payload.maxProfiles}`);
    
    // Save to file
    const outputPath = path.join(__dirname, '../data/test-license-free-30days.jwt');
    fs.writeFileSync(outputPath, freeJWT, 'utf8');
    console.log(`\n💾 JWT saved to: ${outputPath}`);
  } else {
    console.log('❌ JWT Verification: FAIL');
    console.log(`   Error: ${verifyResult.error}`);
  }
  
} catch (error) {
  console.log('❌ JWT Generation Failed:', error.message);
}

// ═══════════════════════════════════════════════════════════════════════
// Test 3: Generate Short-Lived License (7 Days - for expiry warning test)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n\n' + '─'.repeat(60));
console.log('🧪 Test 3: Generate Short-Lived License (7 Days - Expiry Warning Test)');
console.log('─'.repeat(60));

const sevenDays = 7 * 24 * 60 * 60;

const shortPayload = {
  machineCode: machineCode,
  tier: 'pro',
  maxProfiles: -1,
  features: ['unlimited_profiles'],
  issuedAt: now,
  expiresAt: now + sevenDays
};

console.log('\n📝 Payload:');
console.log(JSON.stringify(shortPayload, null, 2));

try {
  const shortJWT = jwt.sign(shortPayload, privateKey, { algorithm: 'RS256' });
  console.log('\n✅ JWT Generated Successfully!');
  console.log(`   Length: ${shortJWT.length} characters`);
  
  // Verify
  const verifyResult = verifyJwtLicense(shortJWT);
  
  if (verifyResult.valid) {
    console.log('✅ JWT Verification: PASS');
    console.log(`   ⚠️  This license will trigger expiry warning in app!`);
    console.log(`   Days until expiry: ${Math.floor((verifyResult.payload.expiresAt - now) / 86400)}`);
    
    // Save to file
    const outputPath = path.join(__dirname, '../data/test-license-pro-7days-warning.jwt');
    fs.writeFileSync(outputPath, shortJWT, 'utf8');
    console.log(`\n💾 JWT saved to: ${outputPath}`);
  } else {
    console.log('❌ JWT Verification: FAIL');
  }
  
} catch (error) {
  console.log('❌ JWT Generation Failed:', error.message);
}

// ═══════════════════════════════════════════════════════════════════════
// Test 4: Generate License for Different Machine (should fail in app)
// ═══════════════════════════════════════════════════════════════════════
console.log('\n\n' + '─'.repeat(60));
console.log('🧪 Test 4: Generate License for Wrong Machine (Should Fail Validation)');
console.log('─'.repeat(60));

const wrongMachinePayload = {
  machineCode: 'WRONG-MACHINE-9999-TEST',
  tier: 'pro',
  maxProfiles: -1,
  features: ['unlimited_profiles'],
  issuedAt: now,
  expiresAt: now + oneYear
};

console.log('\n📝 Payload:');
console.log(JSON.stringify(wrongMachinePayload, null, 2));

try {
  const wrongJWT = jwt.sign(wrongMachinePayload, privateKey, { algorithm: 'RS256' });
  console.log('\n✅ JWT Generated Successfully!');
  
  // This should fail validation
  const verifyResult = verifyJwtLicense(wrongJWT);
  
  if (verifyResult.valid) {
    console.log('❌ UNEXPECTED: JWT passed validation (should have failed!)');
  } else {
    console.log('✅ JWT Validation Failed as Expected');
    console.log(`   Error: ${verifyResult.error}`);
    console.log(`   Machine Code Mismatch: ${verifyResult.machineCodeMismatch}`);
  }
  
} catch (error) {
  console.log('❌ JWT Generation Failed:', error.message);
}

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════
console.log('\n\n' + '═'.repeat(60));
console.log('                    TEST SUMMARY');
console.log('═'.repeat(60));
console.log('\n✅ All JWT generation tests completed!');
console.log('\n📦 Generated test licenses saved to data/ directory:');
console.log('   1. test-license-pro-1year.jwt         (Pro, 1 year)');
console.log('   2. test-license-free-30days.jwt       (Free, 30 days)');
console.log('   3. test-license-pro-7days-warning.jwt (Pro, 7 days - triggers warning)');
console.log('\n🚀 Next Steps:');
console.log('   1. Start Electron app: npm run dev');
console.log('   2. Go to Settings → Activate License');
console.log('   3. Paste JWT from data/test-license-pro-1year.jwt');
console.log('   4. Verify Pro tier activated with unlimited profiles');
console.log('\n💡 To test HTML generator manually:');
console.log('   1. Open tools/license-generator.html in browser');
console.log('   2. Paste private key from scripts/keys/private.pem');
console.log('   3. Enter machine code: ' + machineCode);
console.log('   4. Generate JWT and compare with test files above');
console.log('═'.repeat(60) + '\n');
