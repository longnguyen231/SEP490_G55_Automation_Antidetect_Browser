# JWT License System - Complete Documentation

This is the master documentation for the OBT Antidetect Browser JWT-based license management system.

## 📚 Quick Links

- **[LICENSE-GENERATOR-GUIDE.md](./LICENSE-GENERATOR-GUIDE.md)** - How to use the offline JWT generator tool
- **[FIRESTORE-SETUP.md](./FIRESTORE-SETUP.md)** - Firebase Firestore configuration guide
- **[LICENSE-TESTING-GUIDE.md](./LICENSE-TESTING-GUIDE.md)** - Comprehensive testing procedures

---

## 🎯 System Overview

The license system uses **JWT (JSON Web Tokens)** with **RS256 asymmetric encryption** to provide secure, flexible licensing for the OBT Antidetect Browser.

### Key Features

✅ **Tier-Based Licensing**: Free (5 profiles) vs Pro (unlimited)  
✅ **Expiry Management**: Automatic downgrade when license expires  
✅ **Offline Validation**: No internet required after activation  
✅ **Machine-Locked**: Each license tied to specific device fingerprint  
✅ **Tamper-Proof**: RS256 signature prevents JWT modification  
✅ **Web Request Portal**: Users submit requests via public form  
✅ **Admin Dashboard**: Manage requests, generate licenses offline  

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LICENSE LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘

1️⃣ USER REQUEST (Public)
   ↓
   Web Portal (browser.hl-mck.store/license-request)
   → Submit machineCode + email + tier
   → Firestore: licenseRequests collection (status: pending)

2️⃣ ADMIN REVIEW
   ↓
   Web Admin (/dashboard/license-requests)
   → View pending requests
   → Approve/Reject
   → Copy machineCode

3️⃣ ADMIN GENERATE JWT (Offline)
   ↓
   Offline HTML Tool (tools/license-generator.html)
   → Load private key (from local file)
   → Paste machineCode
   → Select tier + duration
   → Generate RS256-signed JWT
   
4️⃣ ADMIN DELIVER
   ↓
   Email/Discord/Support Ticket
   → Send JWT string to user
   → Mark request "completed" in web admin

5️⃣ USER ACTIVATE
   ↓
   Electron App (Settings → Activate License)
   → Paste JWT
   → Validate signature + machineCode + expiry
   → Save to data/license.json
   
6️⃣ ONGOING VALIDATION
   ↓
   On every app startup:
   → Load license.json
   → Re-verify JWT signature
   → Check expiry date
   → Apply tier limits (free: 5, pro: unlimited)
```

---

## 🔐 Security Model

### Asymmetric Cryptography (RS256)

**Why RS256 instead of HS256?**

- **HS256 (Symmetric)**: Same secret key for signing AND verifying
  - ❌ Secret must be embedded in Electron app → easily extracted from binary
  - ❌ Users could generate their own licenses

- **RS256 (Asymmetric)**: Private key (signing) ≠ Public key (verification)
  - ✅ Public key embedded in app (safe to expose)
  - ✅ Private key stays OFFLINE with admin (never in app)
  - ✅ Users cannot forge licenses without private key

### Key Management

**Private Key** (`scripts/keys/private.pem`):
- 🔒 **CRITICAL**: Never commit to Git, never upload to cloud
- 📍 **Storage**: Admin local machine, USB backup, encrypted vault
- 🎯 **Usage**: Only in offline HTML tool (`tools/license-generator.html`)

**Public Key** (`scripts/keys/public.pem`):
- ✅ **Safe to embed**: Hardcoded in `src/main/services/licenseValidator.js`
- 🎯 **Usage**: Electron app verifies JWT signatures on startup

### Attack Surface Mitigation

| Attack Vector | Mitigation |
|--------------|------------|
| JWT Tampering | RS256 signature verification - any modification invalidates token |
| Machine Code Spoofing | Server-side validation, normalized comparison (case-insensitive) |
| Expired License Reuse | Re-validation on every startup, expiry timestamp checked |
| License Sharing | Machine code locked to single device fingerprint |
| Private Key Theft | Offline storage only, never in app binary or web server |
| Firestore Injection | Auto-sanitized by Firebase SDK, security rules enforce schema |

---

## 📦 Components

### 1. Backend (Electron Main Process)

**File**: `src/main/services/licenseValidator.js`

**Functions**:
```javascript
verifyJwtLicense(jwtString)        // Core validation logic
loadLicenseFromDisk()              // Read license.json on startup
saveLicenseToDisk(jwt, payload)    // Atomic write after activation
getLicenseTier()                   // Get current tier info (free/pro)
deactivateLicense()                // Remove license + clear storage
```

**Validation Steps**:
1. Parse JWT (3 parts: header.payload.signature)
2. Verify RS256 signature using embedded public key
3. Check expiry: `payload.expiresAt > Date.now()`
4. Check machineCode: `payload.machineCode === getMachineCode()`
5. Return `{ valid, payload?, error?, expired?, machineCodeMismatch? }`

**Profile Limit Enforcement**:
- `src/main/storage/profiles.js` calls `getLicenseTier()` on profile creation
- Free tier: Block if `profiles.length >= 5`
- Pro tier: Unlimited (`maxProfiles: -1`)

### 2. Frontend (Electron Renderer)

**File**: `src/renderer/components/LicenseModal.jsx`

**Features**:
- Toggle JWT textarea vs legacy key input
- Real-time validation on paste
- Specific error messages (expired, wrong machine, invalid)
- Link to web request portal

**File**: `src/renderer/components/LicenseInfoPanel.jsx`

**Features**:
- Display current tier badge (Free 🆓 / Pro 👑)
- Show expiry date + days remaining
- Feature list for current tier
- Expiry warnings (< 7 days: orange alert)
- Deactivate button with confirmation

**File**: `src/renderer/App.jsx`

**Features**:
- Startup license check: `checkLicenseStatus()` on mount
- Expiry warning banner at app top
- License state management (tier, expiry, features)

### 3. Offline Generator Tool

**File**: `tools/license-generator.html`

**Tech Stack**: Pure HTML + CSS + JS, uses jsrsasign CDN for RS256

**Features**:
- Private key upload/paste (supports .pem files)
- LocalStorage persistence (optional convenience)
- Machine code input with validation
- Tier selection (Free/Pro)
- Duration presets (1m, 6m, 1y, 5y, lifetime)
- JWT generation with copy/download buttons
- Built-in JWT decoder for debugging
- Security warnings and best practices

**Distribution**: Standalone file, works offline, no dependencies

### 4. Web Admin Portal

**Files**:
- `src/web-admin/src/pages/LicenseRequests/PublicRequest.jsx` - Public submission form
- `src/web-admin/src/pages/LicenseRequests/Manage.jsx` - Admin dashboard

**Public Request Form** (`/license-request`):
- No authentication required
- Fields: machineCode, email, tier, message
- Writes to Firestore `licenseRequests` collection
- Pre-fills machineCode from URL param: `?machineCode=ABC123...`

**Admin Dashboard** (`/dashboard/license-requests`):
- Firebase Auth protected (admin emails only)
- Real-time listener for request updates
- Filter tabs: All | Pending | Approved | Completed | Rejected
- Actions: Copy machineCode, Approve, Reject, Mark Completed, Delete
- Status workflow: Pending → Approved → Completed

### 5. Firestore Database

**Collection**: `licenseRequests`

**Security Rules**:
- ✅ Public: `create` (anonymous users can submit)
- 🔒 Admin-only: `read`, `update`, `delete`

**Indexes Required**:
- `status` (ASC) + `createdAt` (DESC) - for filtered sorting

See [FIRESTORE-SETUP.md](./FIRESTORE-SETUP.md) for complete setup guide.

---

## 🚀 Setup Instructions

### For Developers (First-Time Setup)

1. **Generate RSA Keypair**:
   ```bash
   node scripts/generate-keypair.js
   ```
   - Creates `scripts/keys/private.pem` and `public.pem`
   - Displays public key for copying

2. **Embed Public Key**:
   - Open `src/main/services/licenseValidator.js`
   - Replace `PUBLIC_KEY` constant with generated public key
   - Save file

3. **Secure Private Key**:
   - Copy `scripts/keys/private.pem` to USB backup
   - Never commit to Git (already in `.gitignore`)
   - Share securely with authorized admins only

4. **Setup Firestore** (Web Admin Only):
   - Follow [FIRESTORE-SETUP.md](./FIRESTORE-SETUP.md)
   - Create `licenseRequests` collection
   - Apply security rules
   - Create indexes

5. **Test System**:
   - Follow [LICENSE-TESTING-GUIDE.md](./LICENSE-TESTING-GUIDE.md)
   - Run all 7 test phases
   - Verify end-to-end workflow

### For Admins (License Generation)

1. **Locate Offline Tool**:
   - File: `tools/license-generator.html`
   - Double-click to open in Chrome/Edge

2. **Load Private Key**:
   - Click "Upload .pem file" → Select `private.pem`
   - OR paste key content manually
   - (Optional) Save to localStorage for convenience

3. **Generate License**:
   - Paste user's machineCode (from support request)
   - Select tier: Free or Pro
   - Select duration: 1m, 6m, 1y, 5y, lifetime
   - Click "Generate JWT License"
   - Copy generated token

4. **Deliver to User**:
   - Email/Discord message with JWT string
   - Instructions: "Paste in app → Settings → Activate License"

5. **Update Request Status**:
   - Web Admin → License Requests → Find request
   - Click "✓ Done" to mark completed

**Full details**: [LICENSE-GENERATOR-GUIDE.md](./LICENSE-GENERATOR-GUIDE.md)

---

## 📋 Tier Comparison

| Feature | Free Plan | Pro Plan |
|---------|-----------|----------|
| **Profile Limit** | 5 profiles | Unlimited |
| **Automation Scripts** | ❌ No | ✅ Yes |
| **Team Sharing** | ❌ No | ✅ Yes |
| **Priority Support** | ❌ No | ✅ Yes |
| **Custom Fingerprints** | ❌ No | ✅ Yes |
| **Expiry** | Never | Configurable (1m - lifetime) |

**Upgrade Path**: Free users see persistent CTA in LicenseInfoPanel to request Pro license.

---

## 🔍 Troubleshooting

### User Issues

**"License has expired"**:
- License expiry date passed
- Automatic downgrade to Free tier (5 profiles)
- Solution: Request new Pro license from support

**"This license is for a different device"**:
- Machine code mismatch (license generated for different PC)
- Solution: Request new license with correct machineCode

**"Invalid license signature"**:
- JWT tampered/corrupted during copy-paste
- Solution: Request fresh JWT from admin

**Profile creation fails after activation**:
- Check tier via Settings → License Info
- Free tier: Delete profiles to get under 5 limit
- Pro tier: Check if license expired

### Admin Issues

**Cannot view license requests in web admin**:
- Verify logged in as admin email (Firebase Console → Authentication)
- Check Firestore security rules allow admin reads
- Confirm email in rules: `'xuankien090103@gmail.com'`

**"The query requires an index"**:
- Firestore composite index missing
- Solution: Follow [FIRESTORE-SETUP.md](./FIRESTORE-SETUP.md) Step 1
- Wait 5-10 minutes for index to build

**Offline tool won't generate JWT**:
- Check private key loaded (see "Private Key Status" indicator)
- Verify machineCode non-empty
- Check browser console (F12) for errors
- Ensure using modern browser (Chrome 90+, Edge 90+)

### Developer Issues

**Public key mismatch errors**:
- Public key in `licenseValidator.js` doesn't match `public.pem`
- Solution: Re-run `generate-keypair.js` and update validator

**License not persisting across restarts**:
- Check `data/license.json` file exists
- Verify `loadLicenseFromDisk()` called in bootstrap
- Check IPC handler registration in `handlers.js`

**Profile limits not enforced**:
- Verify `profiles.js` calls `getLicenseTier()` before creating profile
- Check if tier check logic is bypassed
- Test: Deactivate license, try creating 6th profile

---

## 🛠️ Maintenance

### Rotating Keys (Annual Recommended)

1. Generate new keypair: `node scripts/generate-keypair.js`
2. Update public key in `licenseValidator.js`
3. Keep old private key for 30 days (backwards compatibility)
4. Re-issue licenses for affected users

### Cleaning Up Old Requests

Run periodically to delete completed requests older than 30 days:

```javascript
// Firebase Console → Firestore → Run query
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);

const oldRequests = await firebase.firestore()
  .collection('licenseRequests')
  .where('status', '==', 'completed')
  .where('createdAt', '<', cutoff)
  .get();

// Delete in batches
const batch = firebase.firestore().batch();
oldRequests.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

### Monitoring

**Key Metrics**:
- Active Pro licenses: Query `license.json` files across user data
- Request volume: Firestore `licenseRequests` count by status
- Expiry rate: Licenses expiring in next 30 days
- Support burden: Average time pending → completed

**Firestore Query Examples**:
```javascript
// Pending requests count
const pending = await db.collection('licenseRequests')
  .where('status', '==', 'pending')
  .get();
console.log('Pending:', pending.size);

// Requests created this month
const thisMonth = new Date();
thisMonth.setDate(1);
const monthlyRequests = await db.collection('licenseRequests')
  .where('createdAt', '>=', thisMonth)
  .get();
console.log('This month:', monthlyRequests.size);
```

---

## 📝 Development Notes

### Adding New Tiers

1. Update `TIER_CONFIG` in `licenseValidator.js`:
   ```javascript
   const TIER_CONFIG = {
     free: { maxProfiles: 5, features: [] },
     pro: { maxProfiles: -1, features: ['unlimited_profiles', ...] },
     enterprise: { maxProfiles: -1, features: ['unlimited_profiles', 'whitelabel', 'api'] }
   };
   ```

2. Update `license-generator.html` tier dropdown:
   ```html
   <option value="enterprise">Enterprise</option>
   ```

3. Update `LicenseInfoPanel.jsx` badge colors

4. Update Firestore security rules to allow new tier value

### Adding Features to Pro Tier

1. Define feature flag in `TIER_CONFIG.pro.features`
2. Check in feature code:
   ```javascript
   const { features } = getLicenseTier();
   if (features.includes('automation')) {
     // Enable automation
   }
   ```

3. Update LicenseInfoPanel feature checklist

### Custom Expiry Logic

To add "perpetual trial" (no expiry but limited features):

```javascript
// In verifyJwtLicense()
if (payload.expiresAt === null) {
  // No expiry - perpetual license
  return { valid: true, payload, perpetual: true };
}
```

---

## 🔗 Related Documentation

- **AGENTS.md** - Project architecture and development guidelines
- **USAGE.md** - End-user manual for OBT Antidetect Browser
- **README.md** - Project overview and setup instructions

---

## 📞 Support

For technical issues with the license system:

1. Check this documentation first
2. Review test guide: [LICENSE-TESTING-GUIDE.md](./LICENSE-TESTING-GUIDE.md)
3. Check Electron app logs: `data/logs/`
4. Check browser console (F12) for web admin errors
5. Contact: xuankien090103@gmail.com

For feature requests or bug reports:
- Create GitHub issue (if repository public)
- Email developer with reproduction steps

---

## ✅ Pre-Production Checklist

Before releasing to production:

- [ ] RSA keypair generated and keys secured
- [ ] Public key embedded in `licenseValidator.js`
- [ ] Private key backed up (USB + encrypted cloud)
- [ ] Firestore indexes created and enabled
- [ ] Firestore security rules deployed
- [ ] All 28 tests in testing guide passed
- [ ] End-to-end workflow tested (request → generate → activate)
- [ ] Web admin deployed to production domain
- [ ] Offline generator tool tested in clean browser
- [ ] Documentation reviewed and accurate
- [ ] Support team trained on license generation process
- [ ] Monitoring dashboard set up (Firestore queries)

---

**Last Updated**: 2025-05-21  
**System Version**: 1.0  
**Author**: Kien Nguyen  
**License**: Proprietary
