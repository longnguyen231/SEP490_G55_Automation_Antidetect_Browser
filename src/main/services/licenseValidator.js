const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * JWT License Validator
 * 
 * Luồng hoạt động:
 * 1. User activate license trên web → Web trả về JWT token
 * 2. User copy JWT token và paste vào app
 * 3. App decode JWT để lấy thông tin (tier, maxProfiles, expiresAt, features)
 * 4. App lưu license vào file license.json
 * 5. App kiểm tra expiry mỗi lần load
 */

/**
 * Decode JWT token (Base64 URL decode)
 * JWT format: header.payload.signature
 * Chỉ decode payload, không verify signature
 */
function decodeJwtPayload(jwtString) {
  try {
    // JWT có 3 phần: header.payload.signature
    const parts = jwtString.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format. Expected 3 parts separated by dots.');
    }

    const payload = parts[1];
    
    // Base64 URL decode
    // Replace URL-safe characters back to standard Base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    
    // Decode from Base64
    const jsonString = Buffer.from(padded, 'base64').toString('utf8');
    
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${error.message}`);
  }
}

/**
 * Verify JWT License
 * 
 * @param {string} jwtString - JWT token from web admin
 * @returns {Object} { valid, payload?, error?, expired?, nearExpiry? }
 */
function verifyJwtLicense(jwtString) {
  try {
    if (!jwtString || typeof jwtString !== 'string' || !jwtString.trim()) {
      return { valid: false, error: 'JWT token is required' };
    }

    const jwt = jwtString.trim();

    // Decode JWT payload
    let payload;
    try {
      payload = decodeJwtPayload(jwt);
    } catch (decodeError) {
      return { valid: false, error: `Invalid JWT format: ${decodeError.message}` };
    }

    // Validate required fields
    if (!payload.tier) {
      return { valid: false, error: 'Missing required field: tier' };
    }

    if (typeof payload.maxProfiles !== 'number') {
      return { valid: false, error: 'Missing required field: maxProfiles' };
    }

    // Check expiry (if expiresAt is provided)
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    
    if (payload.expiresAt) {
      const expiresAt = Number(payload.expiresAt);
      
      if (expiresAt < now) {
        return { 
          valid: false, 
          expired: true,
          error: `License expired on ${new Date(expiresAt * 1000).toLocaleDateString()}` 
        };
      }

      // Check if expiring soon (within 7 days)
      const daysRemaining = Math.ceil((expiresAt - now) / (60 * 60 * 24));
      const nearExpiry = daysRemaining <= 7 && daysRemaining > 0;

      return {
        valid: true,
        payload: {
          tier: payload.tier,
          maxProfiles: payload.maxProfiles,
          features: payload.features || [],
          expiresAt: payload.expiresAt,
          issuedAt: payload.issuedAt || payload.iat,
          // Thông tin thêm nếu có
          userId: payload.userId,
          email: payload.email,
        },
        nearExpiry,
        daysRemaining,
      };
    }

    // License không có expiry (lifetime license)
    return {
      valid: true,
      payload: {
        tier: payload.tier,
        maxProfiles: payload.maxProfiles,
        features: payload.features || [],
        issuedAt: payload.issuedAt || payload.iat,
        userId: payload.userId,
        email: payload.email,
      },
    };

  } catch (error) {
    return { 
      valid: false, 
      error: `Validation error: ${error.message}` 
    };
  }
}

/**
 * Get license file path
 */
function getLicensePath() {
  try {
    return path.join(app.getPath('userData'), 'license.json');
  } catch (error) {
    // Fallback nếu app chưa ready
    return path.join(__dirname, '../../../data/license.json');
  }
}

/**
 * Save license to disk
 * 
 * @param {string} jwtString - JWT token
 * @param {Object} payload - Decoded JWT payload
 */
function saveLicenseToDisk(jwtString, payload) {
  try {
    const licensePath = getLicensePath();
    
    // Ensure directory exists
    const dir = path.dirname(licensePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const licenseData = {
      jwt: jwtString,
      tier: payload.tier,
      maxProfiles: payload.maxProfiles,
      features: payload.features || [],
      issuedAt: payload.issuedAt ? new Date(payload.issuedAt * 1000).toISOString() : null,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt * 1000).toISOString() : null,
      activatedAt: new Date().toISOString(),
      activated: true,
      // Thông tin thêm
      userId: payload.userId || null,
      email: payload.email || null,
    };

    fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2), 'utf8');
    
    return true;
  } catch (error) {
    console.error('Failed to save license to disk:', error);
    throw new Error(`Failed to save license: ${error.message}`);
  }
}

/**
 * Load license from disk
 * 
 * @returns {Object} License info with validation status
 */
function loadLicenseFromDisk() {
  try {
    const licensePath = getLicensePath();

    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(licensePath)) {
      return {
        valid: false,
        tier: 'free',
        maxProfiles: 5,
        features: [],
        message: 'No license found. Using free plan.',
      };
    }

    // Đọc file license
    const fileContent = fs.readFileSync(licensePath, 'utf8');
    const licenseData = JSON.parse(fileContent);

    // Kiểm tra có JWT không
    if (!licenseData.jwt) {
      return {
        valid: false,
        tier: 'free',
        maxProfiles: 5,
        features: [],
        error: 'Invalid license file: missing JWT token',
      };
    }

    // Re-verify JWT (check expiry again)
    const verifyResult = verifyJwtLicense(licenseData.jwt);

    if (!verifyResult.valid) {
      // License không valid (expired hoặc invalid format)
      return {
        valid: false,
        tier: 'free',
        maxProfiles: 5,
        features: [],
        expired: verifyResult.expired,
        error: verifyResult.error,
        // Giữ lại thông tin cũ để hiển thị
        _oldData: {
          tier: licenseData.tier,
          expiresAt: licenseData.expiresAt,
        },
      };
    }

    // License valid - tính toán thông tin hiển thị
    const now = Date.now();
    let daysRemaining = null;
    let nearExpiry = false;

    if (licenseData.expiresAt) {
      const expiresAt = new Date(licenseData.expiresAt).getTime();
      daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
      nearExpiry = daysRemaining <= 7 && daysRemaining > 0;
    }

    return {
      valid: true,
      tier: licenseData.tier,
      maxProfiles: licenseData.maxProfiles,
      features: licenseData.features || [],
      issuedAt: licenseData.issuedAt,
      expiresAt: licenseData.expiresAt,
      activatedAt: licenseData.activatedAt,
      daysRemaining,
      nearExpiry,
      expired: daysRemaining !== null && daysRemaining < 0,
      userId: licenseData.userId,
      email: licenseData.email,
    };

  } catch (error) {
    console.error('Failed to load license from disk:', error);
    return {
      valid: false,
      tier: 'free',
      maxProfiles: 5,
      features: [],
      error: `Failed to load license: ${error.message}`,
    };
  }
}

/**
 * Deactivate license
 * Xóa file license.json và reset về free plan
 * 
 * @returns {boolean} Success status
 */
function deactivateLicense() {
  try {
    const licensePath = getLicensePath();

    if (fs.existsSync(licensePath)) {
      fs.unlinkSync(licensePath);
    }

    return true;
  } catch (error) {
    console.error('Failed to deactivate license:', error);
    return false;
  }
}

/**
 * Get license status (quick check without full validation)
 * Dùng để check nhanh trong profiles.js
 * 
 * @returns {boolean} True nếu có license active và chưa hết hạn
 */
function isLicenseActivated() {
  try {
    const licensePath = getLicensePath();
    
    if (!fs.existsSync(licensePath)) {
      return false;
    }

    const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    
    // Check activated flag
    if (!licenseData.activated) {
      return false;
    }

    // Check expiry nếu có
    if (licenseData.expiresAt) {
      const now = Date.now();
      const expiresAt = new Date(licenseData.expiresAt).getTime();
      
      if (expiresAt < now) {
        return false; // Expired
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  verifyJwtLicense,
  loadLicenseFromDisk,
  saveLicenseToDisk,
  deactivateLicense,
  isLicenseActivated,
  decodeJwtPayload, // Export để dùng cho testing
};
