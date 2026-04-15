# License System Testing Guide

This guide provides comprehensive testing procedures for the JWT-based license system across all components.

## Prerequisites

Before testing, ensure:
- ✅ RSA keypair generated (`scripts/keys/private.pem` and `public.pem`)
- ✅ Public key embedded in `src/main/services/licenseValidator.js`
- ✅ Electron app built (or running in dev mode)
- ✅ Web admin deployed with Firestore indexes created
- ✅ Admin has access to offline license generator (`tools/license-generator.html`)

---

## Test Phase 1: Backend Infrastructure

### Test 1.1: RSA Keypair Integrity

**Purpose**: Verify public/private key pair is valid and compatible

**Steps**:
```bash
# Navigate to project root
cd "d:\Đồ án\SEP490_G55_Automation_Antidetect_Browser"

# Run keypair generator to verify files exist
node scripts/generate-keypair.js
```

**Expected Output**:
```
⚠️  WARNING: Existing keys will be overwritten in 5 seconds...
   Press Ctrl+C to cancel.

✓ Keys already exist and are valid
   - Private key: scripts/keys/private.pem
   - Public key: scripts/keys/public.pem
```

**Validation**:
- Files `scripts/keys/private.pem` and `scripts/keys/public.pem` exist
- Private key starts with `-----BEGIN PRIVATE KEY-----`
- Public key starts with `-----BEGIN PUBLIC KEY-----`

---

### Test 1.2: License Validator Module

**Purpose**: Verify backend JWT verification logic works correctly

**Test Script** (`test/test-license-validator.js`):
```javascript
const { verifyJwtLicense, saveLicenseToDisk, loadLicenseFromDisk } = require('../src/main/services/licenseValidator');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Load private key for test JWT generation
const privateKey = fs.readFileSync('./scripts/keys/private.pem', 'utf8');

// Get current machine code
const { getMachineCode } = require('../src/main/services/machineId');
const machineCode = getMachineCode();

console.log('=== License Validator Test ===');
console.log('Machine Code:', machineCode);

// Test 1: Valid JWT
const validPayload = {
  machineCode: machineCode,
  tier: 'pro',
  maxProfiles: -1,
  features: ['unlimited_profiles', 'automation', 'team_sharing'],
  issuedAt: Date.now(),
  expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year
};

const validJwt = jwt.sign(validPayload, privateKey, { algorithm: 'RS256' });
console.log('\n[Test 1] Valid JWT:', validJwt.substring(0, 50) + '...');

const result1 = verifyJwtLicense(validJwt);
console.log('Result:', result1.valid ? '✅ PASS' : '❌ FAIL', result1);

// Test 2: Expired JWT
const expiredPayload = {
  ...validPayload,
  expiresAt: Date.now() - 1000 // Expired 1 second ago
};

const expiredJwt = jwt.sign(expiredPayload, privateKey, { algorithm: 'RS256' });
console.log('\n[Test 2] Expired JWT');

const result2 = verifyJwtLicense(expiredJwt);
console.log('Result:', result2.expired ? '✅ PASS (correctly detected)' : '❌ FAIL', result2);

// Test 3: Wrong Machine Code
const wrongMachinePayload = {
  ...validPayload,
  machineCode: 'WRONG-MACHINE-CODE-123'
};

const wrongMachineJwt = jwt.sign(wrongMachinePayload, privateKey, { algorithm: 'RS256' });
console.log('\n[Test 3] Wrong Machine Code JWT');

const result3 = verifyJwtLicense(wrongMachineJwt);
console.log('Result:', result3.machineCodeMismatch ? '✅ PASS (correctly detected)' : '❌ FAIL', result3);

// Test 4: Invalid Signature (modified JWT)
const tamperedJwt = validJwt.substring(0, validJwt.length - 10) + 'TAMPERED!!!';
console.log('\n[Test 4] Tampered JWT');

const result4 = verifyJwtLicense(tamperedJwt);
console.log('Result:', !result4.valid ? '✅ PASS (correctly rejected)' : '❌ FAIL', result4);

// Test 5: Save and Load from Disk
console.log('\n[Test 5] Save/Load License');

saveLicenseToDisk(validJwt, validPayload);
console.log('Saved license to disk');

const loaded = loadLicenseFromDisk();
console.log('Loaded from disk:', loaded.tier === 'pro' ? '✅ PASS' : '❌ FAIL', loaded);

console.log('\n=== All Tests Complete ===');
```

**Run Test**:
```bash
node test/test-license-validator.js
```

**Expected Output**:
```
=== License Validator Test ===
Machine Code: ABC123...

[Test 1] Valid JWT: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Result: ✅ PASS { valid: true, payload: {...} }

[Test 2] Expired JWT
Result: ✅ PASS (correctly detected) { valid: false, expired: true, ... }

[Test 3] Wrong Machine Code JWT
Result: ✅ PASS (correctly detected) { valid: false, machineCodeMismatch: true, ... }

[Test 4] Tampered JWT
Result: ✅ PASS (correctly rejected) { valid: false, error: 'invalid signature' }

[Test 5] Save/Load License
Saved license to disk
Loaded from disk: ✅ PASS { tier: 'pro', ... }

=== All Tests Complete ===
```

---

## Test Phase 2: Offline License Generator

### Test 2.1: HTML Tool Functionality

**Purpose**: Verify offline tool can generate valid JWTs

**Steps**:
1. Open `tools/license-generator.html` in Chrome/Edge
2. Upload private key (click "📁 Upload .pem file")
3. Select `scripts/keys/private.pem`
4. Verify "✅ Private key loaded successfully" message appears
5. Fill form:
   - **Machine Code**: Paste from Electron app (Settings → About → Machine Code)
   - **Tier**: Select "Pro"
   - **Duration**: Select "1 Year"
6. Click "Generate JWT License"
7. Verify JWT appears in output textarea
8. Click "📋 Copy to Clipboard"
9. Click "Decode JWT" button in decoder section

**Expected Behavior**:
- JWT generated without errors
- Decoded payload shows:
  ```json
  {
    "machineCode": "<your-machine-code>",
    "tier": "pro",
    "maxProfiles": -1,
    "features": ["unlimited_profiles", "automation", "team_sharing"],
    "issuedAt": <timestamp>,
    "expiresAt": <timestamp>
  }
  ```
- Expiry date is approximately 1 year from now

**Validation Checks**:
- ✅ JWT is 3 parts separated by dots (header.payload.signature)
- ✅ Signature is approximately 344 characters (RS256 signature length)
- ✅ Decoded payload contains all required fields
- ✅ MachineCode matches your device

---

### Test 2.2: LocalStorage Persistence

**Purpose**: Verify private key persists across browser sessions

**Steps**:
1. Open `license-generator.html` in Chrome
2. Upload private key
3. Close browser tab
4. Reopen `license-generator.html`
5. Verify "✅ Private key loaded from browser storage" message appears
6. Click "🗑️ Clear Stored Key"
7. Refresh page
8. Verify "⚠️ No private key loaded" message appears

**Expected Behavior**:
- Private key automatically loaded on page load (if previously saved)
- "Clear Stored Key" button removes key from localStorage
- Page refresh after clearing shows empty state

---

## Test Phase 3: Electron App Integration

### Test 3.1: License Activation (Valid JWT)

**Purpose**: Verify app can activate license with valid JWT

**Steps**:
1. Start Electron app in dev mode:
   ```bash
   npm run dev
   ```
2. Open Settings → License Management
3. Click "Activate License" button
4. Toggle to "JWT License" input mode
5. Paste valid JWT (from Test 2.1)
6. Click "Activate" button

**Expected Behavior**:
- ✅ Success toast: "License activated successfully!"
- ✅ Modal closes automatically
- ✅ LicenseInfoPanel shows:
  - Tier badge: "👑 Pro"
  - Profile limit: "Unlimited profiles"
  - Expiry date: (1 year from now)
  - Features list: "✓ unlimited profiles", "✓ automation", "✓ team sharing"
- ✅ No expiry warning banner (> 7 days remaining)

**Validation in DevTools**:
```javascript
// Check localStorage
localStorage.getItem('hl-license-activated') // "true"
localStorage.getItem('hl-license-tier') // "pro"
localStorage.getItem('hl-license-expiry') // <timestamp>

// Check backend
window.electronAPI.getLicenseInfo().then(console.log)
// { tier: 'pro', maxProfiles: -1, expiresAt: <timestamp> }
```

---

### Test 3.2: License Activation (Expired JWT)

**Purpose**: Verify app rejects expired license

**Steps**:
1. Generate expired JWT using offline tool:
   - Duration: "1 Month"
   - MANUALLY edit generated JWT payload before signing:
     ```javascript
     // In browser console on license-generator.html
     const payload = {
       machineCode: '<your-code>',
       tier: 'pro',
       maxProfiles: -1,
       features: ['unlimited_profiles'],
       issuedAt: Date.now() - (365 * 24 * 60 * 60 * 1000), // 1 year ago
       expiresAt: Date.now() - (10 * 1000) // Expired 10 seconds ago
     };
     ```
2. Paste expired JWT in Electron app
3. Click "Activate"

**Expected Behavior**:
- ❌ Error toast: "License has expired"
- ❌ Modal remains open
- ❌ License NOT activated
- ❌ LicenseInfoPanel still shows "Free" tier

---

### Test 3.3: License Activation (Wrong Machine Code)

**Purpose**: Verify app rejects JWT for different device

**Steps**:
1. Generate JWT with wrong machine code:
   - Machine Code: "WRONG-MACHINE-CODE-123"
   - Tier: Pro
   - Duration: 1 Year
2. Paste into Electron app
3. Click "Activate"

**Expected Behavior**:
- ❌ Error toast: "This license is for a different device"
- ❌ License NOT activated

---

### Test 3.4: License Activation (Invalid Signature)

**Purpose**: Verify app rejects tampered JWT

**Steps**:
1. Generate valid JWT
2. Modify last 10 characters of signature:
   ```
   Original: eyJhbG...xyz123
   Modified: eyJhbG...TAMPERED
   ```
3. Paste modified JWT into app
4. Click "Activate"

**Expected Behavior**:
- ❌ Error toast: "Invalid license signature"
- ❌ License NOT activated

---

### Test 3.5: Profile Limit Enforcement (Free Tier)

**Purpose**: Verify free tier enforces 5-profile limit

**Steps**:
1. Deactivate any existing license:
   - Settings → License Info → Click "Deactivate License"
   - Confirm deactivation
2. Verify tier is "Free" (max 5 profiles)
3. Create 5 test profiles:
   - Dashboard → "New Profile" (repeat 5 times)
4. Attempt to create 6th profile

**Expected Behavior**:
- Profiles 1-5: ✅ Created successfully
- Profile 6: ❌ Error: "Free plan allows maximum 5 profiles. Upgrade to Pro for unlimited profiles."
- Profile count remains at 5

---

### Test 3.6: Profile Limit Enforcement (Pro Tier)

**Purpose**: Verify Pro tier allows unlimited profiles

**Steps**:
1. Activate Pro license (valid JWT)
2. Create 10+ profiles

**Expected Behavior**:
- ✅ All profiles created successfully
- No limit error shown

---

### Test 3.7: Expiry Warning Banner (< 7 Days)

**Purpose**: Verify app shows warning when license expiring soon

**Setup**:
Generate short-lived JWT (7 days or less):
```javascript
// In license-generator.html console (AFTER loading private key)
const privateKey = localStorage.getItem('licenseGeneratorPrivateKey');
const payload = {
  machineCode: '<your-code>',
  tier: 'pro',
  maxProfiles: -1,
  features: ['unlimited_profiles'],
  issuedAt: Date.now(),
  expiresAt: Date.now() + (5 * 24 * 60 * 60 * 1000) // 5 days from now
};

const header = { alg: 'RS256', typ: 'JWT' };
const sHeader = JSON.stringify(header);
const sPayload = JSON.stringify(payload);
const token = KJUR.jws.JWS.sign('RS256', sHeader, sPayload, privateKey);
console.log('Short-lived JWT:', token);
// Copy this token
```

**Steps**:
1. Activate short-lived JWT (5 days expiry)
2. Check top of app for warning banner

**Expected Behavior**:
- ⚠️ Orange warning banner appears:
  ```
  ⚠️ Your Pro license will expire in 5 days. Please renew to avoid interruption.
  ```
- LicenseInfoPanel shows: "⏰ Expires in 5 days"

---

### Test 3.8: License Deactivation

**Purpose**: Verify deactivation clears license data

**Steps**:
1. With active Pro license, go to Settings → License Info
2. Click "Deactivate License" button
3. Confirm in dialog
4. Check license status

**Expected Behavior**:
- ✅ Success toast: "License deactivated successfully"
- ✅ App reloads automatically
- ✅ LicenseInfoPanel shows "Free" tier
- ✅ localStorage cleared:
  ```javascript
  localStorage.getItem('hl-license-activated') // null
  localStorage.getItem('hl-license-tier') // null
  ```
- ✅ `license.json` file deleted from disk

---

### Test 3.9: License Persistence Across Restarts

**Purpose**: Verify license survives app restart

**Steps**:
1. Activate valid Pro license
2. Close Electron app completely (Ctrl+Q or Cmd+Q)
3. Reopen app
4. Check license status immediately

**Expected Behavior**:
- ✅ Pro license still active (no re-activation needed)
- ✅ LicenseInfoPanel shows Pro tier
- ✅ No errors in console logs

---

## Test Phase 4: Web Admin Portal

### Test 4.1: Public License Request Submission

**Purpose**: Verify public users can submit license requests

**Steps**:
1. Open browser (incognito mode to simulate anonymous user)
2. Navigate to: `https://browser.hl-mck.store/license-request`
3. Fill form:
   - **Machine Code**: Get from Electron app (or paste test code)
   - **Email**: `testuser@example.com`
   - **Tier**: Select "Pro"
   - **Message**: "Please upgrade my license for testing"
4. Click "Submit Request"

**Expected Behavior**:
- ✅ Success toast: "Request submitted! We'll contact you at testuser@example.com"
- ✅ Form clears automatically
- ✅ After 3 seconds: Redirect to landing page (`/`)
- ✅ Request appears in Firestore (verify in Firebase Console or admin panel)

**Firestore Validation**:
```javascript
// Firebase Console → Firestore Database → licenseRequests collection
{
  machineCode: "<test-code>",
  email: "testuser@example.com",
  tier: "pro",
  message: "Please upgrade my license for testing",
  status: "pending",
  createdAt: <timestamp>
}
```

---

### Test 4.2: Admin Dashboard - View Requests

**Purpose**: Verify admin can view all license requests

**Steps**:
1. Log in as admin at `/login` (xuankien090103@gmail.com)
2. Navigate to `/dashboard/license-requests`
3. Verify sidebar shows "License Requests" menu item
4. Check requests table

**Expected Behavior**:
- ✅ Table displays all requests (newest first)
- ✅ Columns shown: Email, Machine Code, Tier, Status, Created, Actions
- ✅ Test request from Test 4.1 appears with status "pending"
- ✅ Machine code displayed as monospaced font
- ✅ Copy button next to machine code

**Real-Time Test**:
1. Keep admin panel open
2. Open new incognito tab → Submit another request
3. Return to admin panel (do NOT refresh)

**Expected Behavior**:
- ✅ New request appears immediately (real-time listener working)

---

### Test 4.3: Admin Actions - Copy Machine Code

**Purpose**: Verify admin can easily copy machine codes

**Steps**:
1. In admin panel, find any request
2. Click copy icon (📋) next to machine code

**Expected Behavior**:
- ✅ Success toast: "Machine code copied!"
- ✅ Icon changes to checkmark (✓) for 2 seconds
- ✅ Clipboard contains machine code (paste to verify)

---

### Test 4.4: Admin Actions - Approve Request

**Purpose**: Verify status change workflow

**Steps**:
1. Find "pending" request in admin panel
2. Click green checkmark (✓) icon in Actions column
3. Verify status updates

**Expected Behavior**:
- ✅ Success toast: "Request marked as approved"
- ✅ Status badge changes to "approved" (blue color)
- ✅ Approve/Reject buttons disappear
- ✅ "✓ Done" button appears

---

### Test 4.5: Admin Actions - Reject Request

**Purpose**: Verify rejection workflow

**Steps**:
1. Find "pending" request
2. Click red X icon
3. Verify status updates

**Expected Behavior**:
- ✅ Success toast: "Request marked as rejected"
- ✅ Status badge changes to "rejected" (red color)
- ✅ No action buttons remain (only Delete)

---

### Test 4.6: Admin Actions - Mark Completed

**Purpose**: Verify completion workflow after JWT delivery

**Steps**:
1. Find "approved" request in admin panel
2. Click "✓ Done" button
3. Verify status updates

**Expected Behavior**:
- ✅ Success toast: "Request marked as completed"
- ✅ Status badge changes to "completed" (green color)

---

### Test 4.7: Admin Actions - Delete Request

**Purpose**: Verify admin can remove spam/duplicates

**Steps**:
1. Find any request
2. Click trash icon (🗑️)
3. Confirm in browser prompt

**Expected Behavior**:
- ✅ Browser confirmation dialog appears
- ✅ After confirm: Success toast "Request deleted"
- ✅ Request disappears from table immediately
- ✅ Document deleted from Firestore

---

### Test 4.8: Filter Tabs

**Purpose**: Verify filtering works for all status types

**Steps**:
1. In admin panel, submit multiple requests with different statuses (use Test 4.1)
2. Approve 1 request
3. Reject 1 request
4. Mark 1 as completed
5. Leave 1 as pending
6. Click each filter tab:
   - All
   - Pending
   - Approved
   - Completed
   - Rejected

**Expected Behavior**:
For each tab:
- ✅ Count badge shows correct number
- ✅ Table filters to show only matching requests
- ✅ Active tab highlighted (purple background)

---

## Test Phase 5: End-to-End Workflow

### Test 5.1: Complete License Request Lifecycle

**Purpose**: Verify entire workflow from user request to activation

**Steps**:

1. **User: Request License via Web Portal**
   - Open `https://browser.hl-mck.store/license-request` in Electron app
   - Copy machine code from app (Settings → About)
   - Fill form with real email, select Pro tier
   - Submit request

2. **Admin: Review Request**
   - Log in to web admin
   - Navigate to License Requests
   - Find user's pending request
   - Click "Approve" (✓)

3. **Admin: Generate JWT**
   - Click copy button next to machine code
   - Open `tools/license-generator.html`
   - Upload private key (or load from localStorage)
   - Paste machine code
   - Select Pro tier, 1 Year duration
   - Click "Generate JWT License"
   - Copy generated JWT

4. **Admin: Deliver JWT to User**
   - (Typically: email JWT to user)
   - For testing: Paste JWT in Notepad

5. **Admin: Mark Request Completed**
   - Return to web admin
   - Find approved request
   - Click "✓ Done" button
   - Status changes to "completed"

6. **User: Activate License**
   - In Electron app: Settings → Activate License
   - Toggle to JWT mode
   - Paste JWT
   - Click Activate

7. **User: Verify Activation**
   - Check LicenseInfoPanel shows Pro tier
   - Try creating 10+ profiles (should succeed)
   - Restart app and verify license persists

**Expected End State**:
- ✅ User has working Pro license
- ✅ Request marked "completed" in admin panel
- ✅ User can create unlimited profiles
- ✅ License survives app restart

---

## Test Phase 6: Edge Cases & Security

### Test 6.1: Modified license.json File

**Purpose**: Verify app re-validates license on startup

**Steps**:
1. Activate valid Pro license
2. Close Electron app
3. Open `data/license.json` in text editor
4. Change `"tier": "pro"` to `"tier": "free"`
5. Save file
6. Restart Electron app

**Expected Behavior**:
- ✅ App detects invalid signature or mismatch
- ✅ License reverted to Free tier
- ✅ Warning logged in console

---

### Test 6.2: Deleted license.json File

**Purpose**: Verify app handles missing license gracefully

**Steps**:
1. Activate valid license
2. Close app
3. Delete `data/license.json`
4. Restart app

**Expected Behavior**:
- ✅ App defaults to Free tier
- ✅ No errors in console
- ✅ LicenseInfoPanel shows Free tier

---

### Test 6.3: Concurrent License Activation

**Purpose**: Verify only one license active at a time

**Steps**:
1. Activate Pro license (1 year)
2. Activate DIFFERENT Pro license (also 1 year) WITHOUT deactivating first
3. Check which license is active

**Expected Behavior**:
- ✅ Second license replaces first
- ✅ `license.json` contains only second JWT
- ✅ No duplicate license data

---

### Test 6.4: SQL Injection in Machine Code (Firestore)

**Purpose**: Verify sanitization prevents injection attacks

**Steps**:
1. Submit license request with malicious machine code:
   ```
   '; DROP TABLE licenseRequests; --
   ```
2. Check Firestore console

**Expected Behavior**:
- ✅ Request stored with literal string (no code execution)
- ✅ No database modifications
- ✅ Admin panel displays encoded string safely

---

### Test 6.5: XSS in Request Message (Web Admin)

**Purpose**: Verify HTML/JS escaping in admin panel

**Steps**:
1. Submit request with XSS payload in message field:
   ```html
   <script>alert('XSS')</script><img src=x onerror=alert('XSS2')>
   ```
2. Open admin panel and view request

**Expected Behavior**:
- ✅ No alert popups appear
- ✅ Message displays as plain text: `<script>alert('XSS')</script>...`
- ✅ React auto-escapes HTML

---

## Test Phase 7: Performance & Reliability

### Test 7.1: Large Request Volume (Firestore Scaling)

**Purpose**: Verify system handles 1000+ requests

**Load Test Script**:
```javascript
// Run in browser console on /license-request page (after logging in as admin)
async function createBulkRequests(count) {
  for (let i = 0; i < count; i++) {
    await firebase.firestore().collection('licenseRequests').add({
      machineCode: `TEST-${i}-${Date.now()}`,
      email: `test${i}@example.com`,
      tier: i % 2 === 0 ? 'pro' : 'free',
      message: `Bulk test request #${i}`,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    if (i % 100 === 0) console.log(`Created ${i} requests...`);
  }
  console.log(`✅ Created ${count} requests`);
}

await createBulkRequests(1000);
```

**Steps**:
1. Run load test script
2. Navigate to admin panel `/dashboard/license-requests`
3. Measure page load time and scrolling performance

**Expected Behavior**:
- ✅ Admin panel loads within 3 seconds
- ✅ Infinite scroll or pagination works smoothly
- ✅ Real-time listener handles 1000+ docs efficiently

---

### Test 7.2: Offline Resilience (Network Disconnection)

**Purpose**: Verify app handles network failures gracefully

**Steps**:
1. Disconnect from internet (airplane mode)
2. Attempt to submit license request from public page
3. Reconnect to internet
4. Retry submission

**Expected Behavior**:
- ❌ Offline: Error toast "Failed to submit request"
- ✅ Online: Request submits successfully
- ✅ No data loss during offline period

---

## Reporting Test Results

Create test report in this format:

```markdown
# License System Test Results

**Date**: YYYY-MM-DD
**Tester**: [Your Name]
**Build**: [Electron version / Commit hash]

---

## Phase 1: Backend Infrastructure
- [x] Test 1.1: RSA Keypair Integrity - PASS
- [x] Test 1.2: License Validator Module - PASS (all 5 subtests)

## Phase 2: Offline Generator
- [x] Test 2.1: HTML Tool Functionality - PASS
- [x] Test 2.2: LocalStorage Persistence - PASS

## Phase 3: Electron Integration
- [x] Test 3.1: Valid JWT Activation - PASS
- [x] Test 3.2: Expired JWT Rejection - PASS
- [x] Test 3.3: Wrong Machine Code Rejection - PASS
- [x] Test 3.4: Invalid Signature Rejection - PASS
- [x] Test 3.5: Free Tier Limit (5 profiles) - PASS
- [x] Test 3.6: Pro Tier Unlimited - PASS
- [x] Test 3.7: Expiry Warning Banner - PASS
- [x] Test 3.8: License Deactivation - PASS
- [x] Test 3.9: Persistence Across Restarts - PASS

## Phase 4: Web Admin Portal
- [x] Test 4.1: Public Request Submission - PASS
- [x] Test 4.2: Admin View Requests - PASS (including real-time)
- [x] Test 4.3: Copy Machine Code - PASS
- [x] Test 4.4: Approve Request - PASS
- [x] Test 4.5: Reject Request - PASS
- [x] Test 4.6: Mark Completed - PASS
- [x] Test 4.7: Delete Request - PASS
- [x] Test 4.8: Filter Tabs - PASS

## Phase 5: End-to-End Workflow
- [x] Test 5.1: Complete Lifecycle - PASS

## Phase 6: Edge Cases & Security
- [x] Test 6.1: Modified license.json - PASS
- [x] Test 6.2: Deleted license.json - PASS
- [x] Test 6.3: Concurrent Activation - PASS
- [x] Test 6.4: SQL Injection Prevention - PASS
- [x] Test 6.5: XSS Prevention - PASS

## Phase 7: Performance
- [x] Test 7.1: Large Request Volume (1000 requests) - PASS (load time: 2.1s)
- [x] Test 7.2: Offline Resilience - PASS

---

**Summary**: 28/28 tests passed (100%)
**Issues Found**: None
**Recommendations**: Ready for production
```

---

## Automated Testing (Optional)

For continuous integration, create Vitest test suite:

```javascript
// tests/license-system.spec.js
import { describe, it, expect } from 'vitest';
import { verifyJwtLicense } from '../src/main/services/licenseValidator';

describe('License Validator', () => {
  it('should accept valid JWT', () => {
    const result = verifyJwtLicense(VALID_JWT_FIXTURE);
    expect(result.valid).toBe(true);
  });
  
  it('should reject expired JWT', () => {
    const result = verifyJwtLicense(EXPIRED_JWT_FIXTURE);
    expect(result.expired).toBe(true);
  });
  
  // Add more automated tests...
});
```

Run with: `npm run test`

---

## Support & Troubleshooting

If tests fail, check:
1. **Logs**: Electron main process logs (`data/logs/`)
2. **Console**: Browser DevTools (F12) for web admin errors
3. **Firestore**: Firebase Console → Firestore → Data
4. **Network**: DevTools Network tab for API failures

For questions, refer to:
- [LICENSE-GENERATOR-GUIDE.md](./LICENSE-GENERATOR-GUIDE.md) - Offline tool docs
- [FIRESTORE-SETUP.md](./FIRESTORE-SETUP.md) - Database configuration
- [AGENTS.md](../AGENTS.md) - Architecture overview
