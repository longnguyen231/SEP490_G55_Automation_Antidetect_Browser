/**
 * License Validator Test Suite
 * Tests JWT verification, expiry, machine code validation
 */

const { verifyJwtLicense, saveLicenseToDisk, loadLicenseFromDisk, getLicenseTier } = require('../src/main/services/licenseValidator');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Load private key for test JWT generation
const privateKeyPath = path.join(__dirname, '../scripts/keys/private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ Error: private.pem not found. Run: node scripts/generate-keypair.js');
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

// Get current machine code
const { getMachineCode } = require('../src/main/services/machineId');
const machineCode = getMachineCode();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         LICENSE VALIDATOR TEST SUITE                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`📌 Machine Code: ${machineCode}\n`);

let passCount = 0;
let failCount = 0;

function runTest(testName, testFn) {
  try {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🧪 ${testName}`);
    console.log('─'.repeat(60));
    const result = testFn();
    if (result) {
      console.log('✅ PASS');
      passCount++;
    } else {
      console.log('❌ FAIL');
      failCount++;
    }
  } catch (error) {
    console.log(`❌ FAIL - ${error.message}`);
    failCount++;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Test 1: Valid JWT (should pass)
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 1: Valid JWT with Pro tier', () => {
  const validPayload = {
    machineCode: machineCode,
    tier: 'pro',
    maxProfiles: -1,
    features: ['unlimited_profiles', 'automation', 'team_sharing'],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year (in seconds)
  };

  const validJwt = jwt.sign(validPayload, privateKey, { algorithm: 'RS256' });
  console.log(`   JWT (first 80 chars): ${validJwt.substring(0, 80)}...`);
  console.log(`   Length: ${validJwt.length} chars`);

  const result = verifyJwtLicense(validJwt);
  console.log(`   Result:`, JSON.stringify({
    valid: result.valid,
    tier: result.payload?.tier,
    expiresIn: result.payload?.expiresAt ? Math.floor((result.payload.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)) + ' days' : 'N/A'
  }, null, 2));

  return result.valid === true && result.payload.tier === 'pro';
});

// ═══════════════════════════════════════════════════════════════════════
// Test 2: Expired JWT (should fail with expired flag)
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 2: Expired JWT detection', () => {
  const expiredPayload = {
    machineCode: machineCode,
    tier: 'pro',
    maxProfiles: -1,
    features: ['unlimited_profiles'],
    issuedAt: Math.floor(Date.now() / 1000) - (400 * 24 * 60 * 60), // 400 days ago (seconds)
    expiresAt: Math.floor(Date.now() / 1000) - (35 * 24 * 60 * 60) // Expired 35 days ago (seconds)
  };

  const expiredJwt = jwt.sign(expiredPayload, privateKey, { algorithm: 'RS256' });
  console.log(`   Expired: ${Math.floor((Date.now() - expiredPayload.expiresAt) / (24 * 60 * 60 * 1000))} days ago`);

  const result = verifyJwtLicense(expiredJwt);
  console.log(`   Result:`, JSON.stringify({
    valid: result.valid,
    expired: result.expired,
    error: result.error
  }, null, 2));

  return result.valid === false && result.expired === true;
});

// ═══════════════════════════════════════════════════════════════════════
// Test 3: Wrong Machine Code (should fail with machineCodeMismatch)
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 3: Wrong machine code rejection', () => {
  const wrongMachinePayload = {
    machineCode: 'WRONG-MACHINE-CODE-XXXXXXXXX',
    tier: 'pro',
    maxProfiles: -1,
    features: ['unlimited_profiles'],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
  };

  const wrongMachineJwt = jwt.sign(wrongMachinePayload, privateKey, { algorithm: 'RS256' });
  console.log(`   Expected: ${machineCode}`);
  console.log(`   Got: ${wrongMachinePayload.machineCode}`);

  const result = verifyJwtLicense(wrongMachineJwt);
  console.log(`   Result:`, JSON.stringify({
    valid: result.valid,
    machineCodeMismatch: result.machineCodeMismatch,
    error: result.error
  }, null, 2));

  return result.valid === false && result.machineCodeMismatch === true;
});

// ═══════════════════════════════════════════════════════════════════════
// Test 4: Tampered JWT (invalid signature)
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 4: Tampered JWT signature detection', () => {
  const validPayload = {
    machineCode: machineCode,
    tier: 'pro',
    maxProfiles: -1,
    features: ['unlimited_profiles'],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
  };

  const validJwt = jwt.sign(validPayload, privateKey, { algorithm: 'RS256' });
  
  // Tamper with signature
  const tamperedJwt = validJwt.substring(0, validJwt.length - 20) + 'TAMPERED_SIGNATURE!!';
  console.log(`   Original length: ${validJwt.length}`);
  console.log(`   Tampered length: ${tamperedJwt.length}`);
  console.log(`   Modified last 20 chars`);

  const result = verifyJwtLicense(tamperedJwt);
  console.log(`   Result:`, JSON.stringify({
    valid: result.valid,
    error: result.error
  }, null, 2));

  return result.valid === false && result.error && result.error.includes('signature');
});

// ═══════════════════════════════════════════════════════════════════════
// Test 5: Modified Payload (change tier to 'enterprise')
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 5: Modified payload detection', () => {
  const validPayload = {
    machineCode: machineCode,
    tier: 'pro',
    maxProfiles: -1,
    features: ['unlimited_profiles'],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
  };

  const validJwt = jwt.sign(validPayload, privateKey, { algorithm: 'RS256' });
  
  // Try to modify payload (change tier to 'enterprise')
  const parts = validJwt.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.tier = 'enterprise'; // Trying to upgrade!
  const modifiedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const modifiedJwt = parts[0] + '.' + modifiedPayloadB64 + '.' + parts[2];

  console.log(`   Original tier: pro`);
  console.log(`   Attempted tier: enterprise (in modified payload)`);

  const result = verifyJwtLicense(modifiedJwt);
  console.log(`   Result:`, JSON.stringify({
    valid: result.valid,
    error: result.error
  }, null, 2));

  return result.valid === false;
});

// ═══════════════════════════════════════════════════════════════════════
// Test 6: Free Tier License
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 6: Free tier license validation', () => {
  const freePayload = {
    machineCode: machineCode,
    tier: 'free',
    maxProfiles: 5,
    features: [],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days (seconds)
  };

  const freeJwt = jwt.sign(freePayload, privateKey, { algorithm: 'RS256' });
  console.log(`   Tier: free`);
  console.log(`   Max Profiles: 5`);

  const result = verifyJwtLicense(freeJwt);
  console.log(`   Result:`, JSON.stringify({
    valid: result.valid,
    tier: result.payload?.tier,
    maxProfiles: result.payload?.maxProfiles
  }, null, 2));

  return result.valid === true && 
         result.payload.tier === 'free' && 
         result.payload.maxProfiles === 5;
});

// ═══════════════════════════════════════════════════════════════════════
// Test 7: Save and Load License from Disk
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 7: Save/Load license persistence', () => {
  const testPayload = {
    machineCode: machineCode,
    tier: 'pro',
    maxProfiles: -1,
    features: ['unlimited_profiles', 'automation'],
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60) // 180 days (seconds)
  };

  const testJwt = jwt.sign(testPayload, privateKey, { algorithm: 'RS256' });
  
  console.log(`   Saving license to disk...`);
  saveLicenseToDisk(testJwt, testPayload);
  
  console.log(`   Loading license from disk...`);
  const loaded = loadLicenseFromDisk();
  
  console.log(`   Loaded:`, JSON.stringify({
    tier: loaded.tier,
    maxProfiles: loaded.maxProfiles,
    features: loaded.features,
    valid: loaded.valid
  }, null, 2));

  return loaded.tier === 'pro' && 
         loaded.maxProfiles === -1 && 
         loaded.valid === true;
});

// ═══════════════════════════════════════════════════════════════════════
// Test 8: Get License Tier Info
// ═══════════════════════════════════════════════════════════════════════
runTest('Test 8: Get license tier configuration', () => {
  const tierInfo = getLicenseTier();
  
  console.log(`   Tier Info:`, JSON.stringify(tierInfo, null, 2));

  return tierInfo.tier !== undefined && tierInfo.maxProfiles !== undefined;
});

// ═══════════════════════════════════════════════════════════════════════
// Test Results Summary
// ═══════════════════════════════════════════════════════════════════════
console.log('\n');
console.log('═'.repeat(60));
console.log('                    TEST SUMMARY');
console.log('═'.repeat(60));
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📊 Total: ${passCount + failCount}`);
console.log(`🎯 Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
console.log('═'.repeat(60));

if (failCount === 0) {
  console.log('\n🎉 All tests passed! License validator is working correctly.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failCount} test(s) failed. Please review errors above.`);
  process.exit(1);
}
