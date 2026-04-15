# License Generator Tool - User Guide

## 📝 Overview

This standalone HTML tool allows administrators to generate JWT license tokens for the HL-MCK Antidetect Browser offline. No internet connection required after initial page load.

## 🔐 Security

**⚠️ CRITICAL SECURITY NOTES:**
- **NEVER** commit `private.pem` to Git
- **NEVER** upload this HTML file with your private key to any server
- Keep `private.pem` in a secure location (encrypted USB, password manager, offline storage)
- Only share **public.pem** (safe to embed in app code)
- Only share **generated JWT** with users (never share private key)

## 🚀 How to Use

### Step 1: Get Private Key

1. Navigate to project root: `SEP490_G55_Automation_Antidetect_Browser`
2. Private key location: `scripts/keys/private.pem`
3. Open `private.pem` in text editor and copy entire content:
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvQIBA... (your key content)
   -----END PRIVATE KEY-----
   ```

### Step 2: Open Generator Tool

1. Double-click `tools/license-generator.html` in File Explorer
2. Opens in your default browser (Chrome/Edge/Firefox)
3. Works 100% offline (after jsrsasign CDN loads once)

### Step 3: Load Private Key

**Option A - Paste:**
1. Paste private key content into "Private Key" textarea
2. Click "Load from Browser Storage" to save for next time

**Option B - Upload:**
1. Click "Upload .pem file" link
2. Select `scripts/keys/private.pem`
3. Key auto-fills in textarea

### Step 4: Fill License Details

1. **Machine Code**: Paste machine code from user
   - User gets this from their Electron app (Help → Machine Code)
   - Format: `XXXX XXXX XXXX XXXX` (16 hex chars with spaces)

2. **License Tier**: Choose from dropdown
   - **Free**: Max 5 profiles
   - **Pro**: Unlimited profiles + API access

3. **Duration**: Select license validity period
   - 1 Month (30 days)
   - 6 Months (180 days)
   - 1 Year (365 days) ⭐ Recommended
   - 5 Years (1825 days)
   - Lifetime (100 years)

### Step 5: Generate JWT

1. Click **"🎫 Generate JWT License"** button
2. JWT appears in output box below
3. Success message shows: Tier + Expiry date

### Step 6: Send to User

**Option A - Copy to Clipboard:**
1. Click **"📋 Copy JWT"** button
2. Paste into email/chat to user

**Option B - Download:**
1. Click **"💾 Download as .txt"** button
2. Saves as `license-jwt.txt`
3. Send file to user via email/Dropbox/etc.

---

## 🧪 Testing & Debugging

### Decode JWT (Verify Before Sending)

1. Scroll to **"4. JWT Decoder"** section
2. Paste generated JWT into textarea
3. Click **"Decode"** button
4. Verify payload shows:
   ```json
   {
     "header": { "alg": "RS256", "typ": "JWT" },
     "payload": {
       "machineCode": "XXXX XXXX XXXX XXXX",
       "tier": "pro",
       "maxProfiles": -1,
       "features": ["unlimited_profiles", "api_access", ...],
       "issuedAt": 1713180000,
       "expiresAt": 1744716000,
       "issuedAtDate": "2024-04-15T10:00:00.000Z",
       "expiresAtDate": "2025-04-15T10:00:00.000Z",
       "daysRemaining": 365
     }
   }
   ```

### Common Errors

**Error: "Private key is required"**
- Solution: Paste private.pem content into textarea

**Error: "Invalid private key format"**
- Solution: Ensure you copied entire key including:
  ```
  -----BEGIN PRIVATE KEY-----
  ... (key content)
  -----END PRIVATE KEY-----
  ```

**Error: "Machine code is required"**
- Solution: Get machine code from user's Electron app

**Error: "JWT generation failed"**
- Solution: Check browser console (F12) for detailed error
- Verify private key is not corrupted
- Try re-generating keypair with `node scripts/generate-keypair.js`

---

## 📋 Admin Workflow

### Scenario 1: User Requests License (Email)

1. User emails: "I want Pro license, my machine code: F3A2 8B4C 9D1E 7F5A"
2. Open `tools/license-generator.html`
3. Load private key
4. Paste machine code: `F3A2 8B4C 9D1E 7F5A`
5. Select tier: **Pro**
6. Select duration: **1 Year**
7. Generate JWT
8. Copy JWT
9. Reply to user with JWT:
   ```
   Your Pro license (expires 2025-04-15):
   
   eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJtYWNoaW5lQ29kZSI6IkYzQTIgOEI0QyA5RDFFIDdGNUEiLCJ0aWVyIjoicHJvIiwibWF4UHJvZmlsZXMiOi0xLCJmZWF0dXJlcyI6WyJ1bmxpbWl0ZWRfcHJvZmlsZXMiLCJhcGlfYWNjZXNzIiwiYXV0b21hdGlvbiIsInByaW9yaXR5X3N1cHBvcnQiXSwiaXNzdWVkQXQiOjE3MTMxODAwMDAsImV4cGlyZXNBdCI6MTc0NDcxNjAwMH0.signature...
   ```

### Scenario 2: User Requests License (Web Admin Portal)

1. User submits request via `browser.hl-mck.store/license-request`
2. Admin logs into Web Admin → `/dashboard/license-requests`
3. See new request → Copy machine code
4. Open `tools/license-generator.html`
5. Load private key
6. Paste machine code from web admin
7. Generate JWT
8. Copy JWT
9. Return to web admin → Mark request as "Completed"
10. Send JWT to user via email

---

## 🔄 Private Key Management

### Save to Browser Storage (Convenience)

- Tool can save your private key to browser's localStorage (Base64 encoded)
- Click "Load from Browser Storage" to auto-fill next time
- **Only use on your personal computer, never on shared computers**

### Clear Browser Storage

- Click "Clear Stored Key" to remove saved private key
- Always clear when finished or before closing browser (good practice)

### Backup Private Key

**Recommended backup locations:**
1. **Password Manager**: LastPass, 1Password, Bitwarden (store as secure note)
2. **Encrypted USB**: BitLocker (Windows) or VeraCrypt encrypted volume
3. **Offline Paper Backup**: Print and store in safe/vault (for disaster recovery)

**Create backup script** (optional):
```bash
# Create encrypted backup of private key
cd SEP490_G55_Automation_Antidetect_Browser/scripts
mkdir -p private-key-backup
cp keys/private.pem private-key-backup/private-$(date +%Y%m%d).pem
# Then manually encrypt the private-key-backup folder with 7-Zip or WinRAR
```

---

## 🆘 Troubleshooting

### Issue: Lost Private Key

**Impact**: All existing licenses become INVALID (can't verify signatures)

**Recovery**:
1. If you have backup → restore from backup
2. If no backup:
   - Generate NEW keypair: `node scripts/generate-keypair.js`
   - Update public key in `src/main/services/licenseValidator.js`
   - Re-issue ALL licenses to existing users
   - Users must re-activate with new JWTs

**Prevention**: Always maintain 2-3 backup copies of private.pem

### Issue: Browser Can't Load Tool

**Symptoms**: HTML file shows blank page or errors

**Solutions**:
1. Check browser console (F12 → Console tab)
2. Ensure internet connection (for jsrsasign CDN to load)
3. Try different browser (Chrome recommended)
4. Disable browser extensions temporarily
5. Download jsrsasign library locally:
   - Download: https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/11.1.0/jsrsasign-all-min.js
   - Save next to HTML file
   - Edit HTML, replace CDN link with: `<script src="jsrsasign-all-min.js"></script>`

### Issue: User Reports "Invalid JWT signature"

**Causes**:
1. User pasted incomplete JWT (missing characters)
2. User modified JWT manually
3. Different public key in app vs private key used to sign

**Solutions**:
1. Ask user to re-paste JWT without modifications
2. Verify you're using correct private.pem (matching public key in app)
3. Re-generate JWT and send again

---

## 📊 Best Practices

### Before Generating License

- ✅ Verify machine code format: 16 hex chars with spaces
- ✅ Confirm payment/subscription status (if applicable)
- ✅ Check if user already has active license (avoid duplicates)
- ✅ Choose appropriate tier based on user's needs
- ✅ Set reasonable expiry date (1 year for Pro)

### After Generating License

- ✅ Decode JWT to verify payload before sending
- ✅ Record in spreadsheet: User email, Machine code, Tier, Expiry date, Issue date
- ✅ Send clear instructions to user on how to activate
- ✅ Mark request as "Completed" in web admin (if using portal)

### Security Checklist

- 🔒 Private key stored securely (encrypted)
- 🔒 Private key backed up in 2+ locations
- 🔒 Never share private key with anyone
- 🔒 Clear browser storage after each session
- 🔒 Don't email screenshots of private key
- 🔒 Use HTTPS for email if sending JWTs

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check browser console (F12) for detailed errors
2. Verify private key format and integrity
3. Test with your own machine code first
4. Contact development team with error logs

---

**Last Updated**: April 15, 2026  
**Version**: 1.0.0  
**Compatible with**: HL-MCK Antidetect Browser v1.0.0+
