#!/usr/bin/env node

/**
 * Test script for JWT License Validator
 * 
 * Usage:
 *   node tools/test-license-validator.js
 */

const path = require('path');

// Mock Electron's app.getPath() for testing
const mockApp = {
  getPath: () => path.join(__dirname, '../data'),
};

// Inject mock
global.app = mockApp;

// Import license validator
const {
  verifyJwtLicense,
  decodeJwtPayload,
  isLicenseActivated,
} = require('../src/main/services/licenseValidator');

// Color console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function info(msg) {
  console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);
}

function section(title) {
  console.log(`\n${colors.yellow}═══ ${title} ═══${colors.reset}\n`);
}

// ========================================
// Test Cases
// ========================================

// Test JWT tokens (generated from generate-jwt.js)
const TEST_TOKENS = {
  pro_30days: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWVyIjoicHJvIiwibWF4UHJvZmlsZXMiOi0xLCJmZWF0dXJlcyI6WyJ1bmxpbWl0ZWRfcHJvZmlsZXMiLCJhdXRvbWF0aW9uIiwiYXBpX2FjY2VzcyIsInByaW9yaXR5X3N1cHBvcnQiXSwiaXNzdWVkQXQiOjE3NzYyODY4MDcsImlhdCI6MTc3NjI4NjgwNywiZXhwaXJlc0F0IjoxNzc4ODc4ODA3fQ.UldZRmB1j7NUwNu9eNVkPhkEgltFYAAZvvhAVhovv3o',
  
  // Expired token (expired in 2025)
  expired: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWVyIjoicHJvIiwibWF4UHJvZmlsZXMiOi0xLCJmZWF0dXJlcyI6W10sImlzc3VlZEF0IjoxNzAwMDAwMDAwLCJpYXQiOjE3MDAwMDAwMDAsImV4cGlyZXNBdCI6MTcwMDYwNDgwMH0.test-signature-expired',
  
  // Invalid format
  invalid: 'this-is-not-a-valid-jwt-token',
  
  // Missing required fields
  missing_fields: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb21lRmllbGQiOiJ2YWx1ZSJ9.signature',
};

// ========================================
// Test Functions
// ========================================

function testDecodePayload() {
  section('Test 1: Decode JWT Payload');
  
  try {
    const payload = decodeJwtPayload(TEST_TOKENS.pro_30days);
    
    if (payload.tier === 'pro') {
      success('Decoded tier correctly: pro');
    } else {
      error('Decoded tier incorrect');
    }
    
    if (payload.maxProfiles === -1) {
      success('Decoded maxProfiles correctly: -1 (unlimited)');
    } else {
      error('Decoded maxProfiles incorrect');
    }
    
    if (Array.isArray(payload.features) && payload.features.length > 0) {
      success(`Decoded features correctly: ${payload.features.length} features`);
    } else {
      error('Decoded features incorrect');
    }
    
    info(`Full payload: ${JSON.stringify(payload, null, 2)}`);
    
  } catch (err) {
    error(`Failed to decode payload: ${err.message}`);
  }
}

function testValidLicense() {
  section('Test 2: Validate Valid License (Pro 30 days)');
  
  try {
    const result = verifyJwtLicense(TEST_TOKENS.pro_30days);
    
    if (result.valid) {
      success('License is valid');
      success(`Tier: ${result.payload.tier}`);
      success(`Max Profiles: ${result.payload.maxProfiles}`);
      success(`Features: ${result.payload.features.join(', ')}`);
      
      if (result.daysRemaining) {
        info(`Days remaining: ${result.daysRemaining}`);
      }
      
      if (result.nearExpiry) {
        info('⚠️  License expiring soon (< 7 days)');
      }
    } else {
      error(`License validation failed: ${result.error}`);
    }
    
  } catch (err) {
    error(`Validation error: ${err.message}`);
  }
}

function testExpiredLicense() {
  section('Test 3: Validate Expired License');
  
  try {
    const result = verifyJwtLicense(TEST_TOKENS.expired);
    
    if (!result.valid && result.expired) {
      success('✓ Correctly detected expired license');
      info(`Error: ${result.error}`);
    } else if (result.valid) {
      error('❌ Should have detected expired license but returned valid');
    } else {
      error(`Unexpected error: ${result.error}`);
    }
    
  } catch (err) {
    error(`Validation error: ${err.message}`);
  }
}

function testInvalidFormat() {
  section('Test 4: Validate Invalid Format');
  
  try {
    const result = verifyJwtLicense(TEST_TOKENS.invalid);
    
    if (!result.valid) {
      success('✓ Correctly rejected invalid JWT format');
      info(`Error: ${result.error}`);
    } else {
      error('❌ Should have rejected invalid format');
    }
    
  } catch (err) {
    error(`Validation error: ${err.message}`);
  }
}

function testMissingFields() {
  section('Test 5: Validate Missing Required Fields');
  
  try {
    const result = verifyJwtLicense(TEST_TOKENS.missing_fields);
    
    if (!result.valid) {
      success('✓ Correctly rejected token with missing fields');
      info(`Error: ${result.error}`);
    } else {
      error('❌ Should have rejected token with missing required fields');
    }
    
  } catch (err) {
    error(`Validation error: ${err.message}`);
  }
}

function testEmptyToken() {
  section('Test 6: Validate Empty Token');
  
  try {
    const result = verifyJwtLicense('');
    
    if (!result.valid) {
      success('✓ Correctly rejected empty token');
      info(`Error: ${result.error}`);
    } else {
      error('❌ Should have rejected empty token');
    }
    
  } catch (err) {
    error(`Validation error: ${err.message}`);
  }
}

// ========================================
// Main
// ========================================

function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     JWT License Validator - Test Suite                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  testDecodePayload();
  testValidLicense();
  testExpiredLicense();
  testInvalidFormat();
  testMissingFields();
  testEmptyToken();
  
  console.log('\n' + '─'.repeat(60));
  console.log(`${colors.green}✓ All tests completed!${colors.reset}`);
  console.log('─'.repeat(60) + '\n');
}

main();
