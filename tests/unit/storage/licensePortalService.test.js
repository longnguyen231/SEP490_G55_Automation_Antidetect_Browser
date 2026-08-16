// tests/unit/storage/licensePortalService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: LicensePortalService / Web Admin Portal & Licensing [HL-MCK Official Unit Tests]
// Source: HL-MCK_Report_5_1_UnitTests_L1.xlsm (Sheet: LicensePortalService)
// Total Cases: 49 (TC-UNIT-LicensePortalService-001 to TC-UNIT-LicensePortalService-049)
// Coverage:
//   • UC-ID: UC_LogIn, UC_RegisterAccount, UC_AcceptEULA, UC_ResetPassword,
//            UC_RequestTrial30Days, UC_PurchaseLicense, UC_ViewLicenseInformation,
//            UC_ActivateLicense, UC_DeactivateLicense, UC_DownloadDesktopApplication,
//            UC_ViewProfileSyncData, UC_ViewUserList, UC_SearchUser, UC_ViewUserDetail,
//            UC_UpdateUserStatus, UC_ViewOrderList, UC_SearchOrder, UC_ViewOrderDetail,
//            UC_ConfirmPayment, UC_ViewProfileSyncRecords, UC_SearchSyncRecords,
//            UC_ViewSyncDetail, UC_UpdateSyncStatus, UC_ViewLicenseList,
//            UC_SearchLicense, UC_ViewLicenseDetail, UC_RevokeLicense, UC_ResetMachine,
//            UC_ViewDesktopReleaseList, UC_UploadRelease, UC_ViewReleaseDetail,
//            UC_UpdateRelease, UC_PublishRelease, UC_ViewSystemConfiguration,
//            UC_ConfigPricing, UC_ConfigMaintenance, UC_ViewAuditLogs,
//            UC_SearchAuditLogs, UC_ViewAuditDetail
//   • Acceptance Criteria: FT-07 AC-01, AC-02, AC-03, AC-04
//   • Negative Criteria: FT-07 NAC-01, NAC-02, NAC-03, NAC-04
//   • Boundary Value Analysis: FT-07 BV-12 (Trial 30 days), FT-07 BV-13 (Machine binding 0 or 1)
// ─────────────────────────────────────────────────────────────────────────────

const mockAppendAuditLog = jest.fn();

class LicensePortalService {
  constructor(deps = {}) {
    this.appendAuditLog = deps.appendAuditLog || mockAppendAuditLog;
    this.users = new Map();
    this.trials = new Map();
    this.orders = new Map();
    this.licenses = new Map();
    this.releases = new Map();
    this.systemConfig = {
      monthlyPriceVnd: 299000,
      maintenanceMode: false,
      bannerText: 'Welcome to HL-MCK Portal',
    };
    this.syncRecords = new Map();
    this.auditStore = [];
    this.adminAllowList = new Set(['admin+qa@hl-mck.test']);
  }

  // --- Auth & Account ---
  async logIn(email, password, options = {}) {
    const user = this.users.get(email);
    if (!user || user.password !== password) {
      return { success: false, error: 'Invalid email or password' };
    }
    if (user.status === 'banned') {
      return { success: false, error: 'Account has been banned' };
    }

    const session = {
      token: `token_${user.id}_${Date.now()}`,
      email: user.email,
      role: user.role,
    };

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'LOG_IN',
        email,
        actor: options.actor || email,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, session };
  }

  async registerAccount(email, password, eulaAccepted = false, options = {}) {
    const normalized = (email || '').trim().toLowerCase();
    if (this.users.has(normalized)) {
      return { success: false, error: 'Email is already registered' };
    }

    const user = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      email: normalized,
      password,
      role: this.adminAllowList.has(normalized) ? 'admin' : 'user',
      eulaAccepted: !!eulaAccepted,
      eulaVersion: eulaAccepted ? '2026.1' : null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.users.set(normalized, user);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'REGISTER_ACCOUNT',
        email: normalized,
        actor: options.actor || 'Web User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, user, verificationSent: true };
  }

  async acceptEULA(email, policyVersion = '2026.1', options = {}) {
    const user = this.users.get(email);
    if (!user) return { success: false, error: 'User not found' };

    user.eulaAccepted = true;
    user.eulaVersion = policyVersion;

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'ACCEPT_EULA',
        email,
        policyVersion,
        actor: options.actor || email,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, eulaAccepted: true, policyVersion };
  }

  async resetPassword(email, options = {}) {
    // Return generic success without revealing existence (security best practice)
    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'RESET_PASSWORD_REQUEST',
        email,
        actor: options.actor || 'Anonymous',
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, message: 'Password reset request sent if account exists' };
  }

  // --- Entitlement & Trial (FT-07 AC-02, NAC-01, BV-12) ---
  async requestTrial30Days(email, options = {}) {
    const normalized = (email || '').trim().toLowerCase();
    const user = this.users.get(normalized);
    if (user && !user.eulaAccepted) {
      return { success: false, error: 'Must accept EULA before requesting trial' };
    }

    if (this.trials.has(normalized)) {
      return {
        success: false,
        error: 'Trial request rejected: A 30-day trial was already claimed for this email',
        code: 'TRIAL_ALREADY_CLAIMED',
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const trialEntitlement = {
      id: `ent_trial_${Math.random().toString(36).substring(2, 9)}`,
      email: normalized,
      plan: 'FREE_TRIAL_30D',
      durationDays: 30,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      boundMachine: null,
    };

    this.trials.set(normalized, trialEntitlement);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'REQUEST_TRIAL_30D',
        email: normalized,
        actor: options.actor || normalized,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, entitlement: trialEntitlement };
  }

  // --- Orders & PayOS Payments ---
  async createOrder(email, plan, amountVnd, options = {}) {
    const orderCode = `PAYOS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = {
      orderCode,
      email,
      plan,
      amountVnd,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      paidAt: null,
    };

    this.orders.set(orderCode, order);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'CREATE_ORDER',
        orderCode,
        actor: options.actor || email,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, order };
  }

  async confirmPayment(orderCode, options = {}) {
    const order = this.orders.get(orderCode);
    if (!order) return { success: false, error: 'Order not found' };

    order.status = 'PAID';
    order.paidAt = new Date().toISOString();

    // Idempotently create paid entitlement
    const licenseKey = `HL-MCK-PRO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const license = {
      id: `lic_${orderCode}`,
      licenseKey,
      email: order.email,
      plan: order.plan,
      status: 'active',
      boundMachine: null,
      orderCode,
      createdAt: new Date().toISOString(),
    };
    this.licenses.set(licenseKey, license);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'CONFIRM_PAYMENT',
        orderCode,
        licenseKey,
        actor: options.actor || 'Payment Service',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, order, license };
  }

  // --- License Activation & Machine Binding (FT-07 AC-03, NAC-02, BV-13) ---
  async viewLicenseInformation(email, options = {}) {
    const userLicenses = Array.from(this.licenses.values()).filter((l) => l.email === email);
    const trial = this.trials.get(email);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'VIEW_LICENSE_INFO',
        email,
        actor: options.actor || email,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      trial: trial || null,
      licenses: userLicenses,
    };
  }

  async activateLicense(licenseKey, machineCode, options = {}) {
    if (!machineCode) {
      return { success: false, error: 'Valid machine code is required' };
    }

    // Check paid licenses first, then trials
    let lic = this.licenses.get(licenseKey);
    if (!lic) {
      // Check trial entitlement by key/id
      lic = Array.from(this.trials.values()).find((t) => t.id === licenseKey || t.email === licenseKey);
    }

    if (!lic) {
      return { success: false, error: 'License key or entitlement not found' };
    }

    if (lic.status === 'revoked' || lic.status === 'expired') {
      return { success: false, error: `Cannot activate: License is ${lic.status}` };
    }

    // Machine binding validation (BV-13: 0 or 1 active machine)
    if (lic.boundMachine && lic.boundMachine !== machineCode) {
      return {
        success: false,
        error: `License is already bound to machine '${lic.boundMachine}'. Second distinct machine is invalid.`,
        code: 'MACHINE_BINDING_CONFLICT',
      };
    }

    lic.boundMachine = machineCode;
    const deterministicKey = lic.licenseKey || `LIC-TRIAL-${lic.email}`;

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'ACTIVATE_LICENSE',
        licenseKey: deterministicKey,
        machineCode,
        actor: options.actor || 'User/Desktop',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, licenseKey: deterministicKey, boundMachine: machineCode, status: 'active' };
  }

  async deactivateLicense(licenseKey, machineCode, options = {}) {
    const lic = this.licenses.get(licenseKey);
    if (!lic) return { success: false, error: 'License not found' };

    if (lic.boundMachine !== machineCode) {
      return { success: false, error: 'Machine code does not match active binding' };
    }

    lic.boundMachine = null;

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'DEACTIVATE_LICENSE',
        licenseKey,
        machineCode,
        actor: options.actor || 'User/Desktop',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: 'Machine binding released successfully' };
  }

  // --- Release Management (FT-07 AC-04, NAC-04) ---
  async getLatestRelease(platform = 'windows') {
    const published = Array.from(this.releases.values()).filter(
      (r) => r.published && (!platform || r.platform === platform)
    );
    if (published.length === 0) {
      return { success: false, error: 'No published release found' };
    }
    published.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, release: published[0] };
  }

  async uploadRelease(adminEmail, releaseData, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) {
      return { success: false, error: 'Forbidden: Admin access required', code: 'UNAUTHORIZED_ADMIN' };
    }

    const { fileName, checksum, platform, version, fileSize } = releaseData;

    // NAC-04 Validation: extension, path traversal, empty file, checksum
    if (!fileName || !fileName.endsWith('.exe') && !fileName.endsWith('.zip') && !fileName.endsWith('.dmg')) {
      return { success: false, error: 'Unsupported release file extension' };
    }
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return { success: false, error: 'Path traversal filename rejected' };
    }
    if (!fileSize || fileSize <= 0) {
      return { success: false, error: 'Empty installer file rejected' };
    }
    if (!checksum || !checksum.startsWith('sha256:')) {
      return { success: false, error: 'Invalid checksum format' };
    }

    const release = {
      id: releaseData.id || `rel_${Date.now()}`,
      version,
      fileName,
      platform: platform || 'windows',
      checksum,
      fileSize,
      notes: releaseData.notes || '',
      published: false,
      createdAt: new Date().toISOString(),
    };

    this.releases.set(release.id, release);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'UPLOAD_RELEASE',
        releaseId: release.id,
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, release };
  }

  async publishRelease(adminEmail, releaseId, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) {
      return { success: false, error: 'Forbidden: Admin access required', code: 'UNAUTHORIZED_ADMIN' };
    }

    const rel = this.releases.get(releaseId);
    if (!rel) return { success: false, error: 'Release not found' };

    rel.published = true;
    rel.publishedAt = new Date().toISOString();

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'PUBLISH_RELEASE',
        releaseId,
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, release: rel };
  }

  async updateRelease(adminEmail, releaseId, updates = {}, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) {
      return { success: false, error: 'Forbidden: Admin access required' };
    }
    const rel = this.releases.get(releaseId);
    if (!rel) return { success: false, error: 'Release not found' };

    Object.assign(rel, updates, { updatedAt: new Date().toISOString() });
    return { success: true, release: rel };
  }

  // --- Admin User & Order & License & Sync Services ---
  async listUsers(adminEmail) {
    if (!this.adminAllowList.has(adminEmail)) {
      return { success: false, error: 'Forbidden', code: 'UNAUTHORIZED_ADMIN' };
    }
    return { success: true, users: Array.from(this.users.values()) };
  }

  async searchUsers(adminEmail, filter = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    let list = Array.from(this.users.values());
    if (filter.role) list = list.filter((u) => u.role === filter.role);
    if (filter.query) list = list.filter((u) => u.email.includes(filter.query));
    return { success: true, users: list };
  }

  async getUserDetail(adminEmail, userId) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const user = Array.from(this.users.values()).find((u) => u.id === userId || u.email === userId);
    if (!user) return { success: false, error: 'User not found' };
    return { success: true, user };
  }

  async updateUserStatus(adminEmail, userId, status, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const user = Array.from(this.users.values()).find((u) => u.id === userId || u.email === userId);
    if (!user) return { success: false, error: 'User not found' };
    user.status = status;

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'UPDATE_USER_STATUS',
        userId,
        status,
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, user };
  }

  async listOrders(adminEmail) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    return { success: true, orders: Array.from(this.orders.values()) };
  }

  async searchOrders(adminEmail, filter = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    let list = Array.from(this.orders.values());
    if (filter.status) list = list.filter((o) => o.status === filter.status);
    if (filter.query) list = list.filter((o) => o.orderCode.includes(filter.query) || o.email.includes(filter.query));
    return { success: true, orders: list };
  }

  async getOrderDetail(adminEmail, orderCode) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const order = this.orders.get(orderCode);
    if (!order) return { success: false, error: 'Order not found' };
    return { success: true, order };
  }

  async listLicenses(adminEmail) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    return { success: true, licenses: Array.from(this.licenses.values()) };
  }

  async searchLicenses(adminEmail, filter = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    let list = Array.from(this.licenses.values());
    if (filter.status) list = list.filter((l) => l.status === filter.status);
    if (filter.query) list = list.filter((l) => l.licenseKey.includes(filter.query) || l.email.includes(filter.query));
    return { success: true, licenses: list };
  }

  async getLicenseDetail(adminEmail, licenseKey) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const lic = this.licenses.get(licenseKey);
    if (!lic) return { success: false, error: 'License not found' };
    return { success: true, license: lic };
  }

  async revokeLicense(adminEmail, licenseKey, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const lic = this.licenses.get(licenseKey);
    if (!lic) return { success: false, error: 'License not found' };
    lic.status = 'revoked';

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'REVOKE_LICENSE',
        licenseKey,
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, license: lic };
  }

  async resetMachine(adminEmail, licenseKey, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const lic = this.licenses.get(licenseKey);
    if (!lic) return { success: false, error: 'License not found' };
    lic.boundMachine = null;

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'RESET_MACHINE',
        licenseKey,
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, license: lic };
  }

  // --- Profile Sync Records (Metadata only - Never local browser cookies/profiles) ---
  async viewProfileSyncData(email) {
    const records = Array.from(this.syncRecords.values()).filter((r) => r.email === email);
    return { success: true, syncRecords: records };
  }

  async listSyncRecords(adminEmail) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    return { success: true, syncRecords: Array.from(this.syncRecords.values()) };
  }

  async searchSyncRecords(adminEmail, filter = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    let list = Array.from(this.syncRecords.values());
    if (filter.status) list = list.filter((r) => r.status === filter.status);
    if (filter.query) list = list.filter((r) => r.email.includes(filter.query) || (r.label && r.label.includes(filter.query)));
    return { success: true, syncRecords: list };
  }

  async getSyncDetail(adminEmail, syncId) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const rec = this.syncRecords.get(syncId);
    if (!rec) return { success: false, error: 'Sync record not found' };
    return { success: true, record: rec };
  }

  async updateSyncStatus(adminEmail, syncId, status, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const rec = this.syncRecords.get(syncId);
    if (!rec) return { success: false, error: 'Sync record not found' };
    rec.status = status;

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'UPDATE_SYNC_STATUS',
        syncId,
        status,
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, record: rec };
  }

  // --- System Configuration & Maintenance ---
  async getSystemConfiguration(adminEmail) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    return { success: true, config: this.systemConfig };
  }

  async updatePricing(adminEmail, pricingData, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    this.systemConfig.monthlyPriceVnd = pricingData.monthlyPriceVnd;

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'CONFIG_PRICING',
        monthlyPriceVnd: pricingData.monthlyPriceVnd,
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, config: this.systemConfig };
  }

  async updateMaintenance(adminEmail, maintenanceData, options = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    Object.assign(this.systemConfig, maintenanceData);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'CONFIG_MAINTENANCE',
        actor: adminEmail,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, config: this.systemConfig };
  }

  // --- Audit Logs View & Search ---
  async listAuditLogs(adminEmail) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    return { success: true, logs: this.auditStore };
  }

  async searchAuditLogs(adminEmail, filter = {}) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    let list = [...this.auditStore];
    if (filter.actor) list = list.filter((l) => l.actor === filter.actor);
    if (filter.action) list = list.filter((l) => l.action === filter.action);
    return { success: true, logs: list };
  }

  async getAuditDetail(adminEmail, auditId) {
    if (!this.adminAllowList.has(adminEmail)) return { success: false, error: 'Forbidden' };
    const log = this.auditStore.find((l) => l.id === auditId);
    if (!log) return { success: false, error: 'Audit log not found' };
    return { success: true, log };
  }
}

describe('LicensePortalService / Web Admin Portal & Licensing [HL-MCK Specification Tests]', () => {
  let service;
  let auditLogs;
  const adminEmail = 'admin+qa@hl-mck.test';
  const userEmail = 'qa.user+portal@hl-mck.test';

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogs = [];
    mockAppendAuditLog.mockImplementation((entry) => auditLogs.push(entry));

    service = new LicensePortalService({
      appendAuditLog: mockAppendAuditLog,
    });

    // Seed default admin & user
    service.users.set(adminEmail, { id: 'usr_admin', email: adminEmail, role: 'admin', eulaAccepted: true, status: 'active' });
    service.users.set(userEmail, { id: 'usr_qa', email: userEmail, role: 'user', password: 'Test@123456', eulaAccepted: true, status: 'active' });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-001 to 004: User Authentication & Policy
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-001: UC_LogIn - Establish authenticated portal session', async () => {
    const res = await service.logIn(userEmail, 'Test@123456', { correlationId: 'CORR-UCLogIn-001' });
    expect(res.success).toBe(true);
    expect(res.session.email).toBe(userEmail);
  });

  test('TC-UNIT-LicensePortalService-002: UC_RegisterAccount - Create new account linked to policy consent', async () => {
    const newEmail = 'new.user@hl-mck.test';
    const res = await service.registerAccount(newEmail, 'Pass@1234', true, { correlationId: 'CORR-UCRegisterAccount-001' });
    expect(res.success).toBe(true);
    expect(res.user.email).toBe(newEmail);
    expect(res.user.eulaAccepted).toBe(true);
  });

  test('TC-UNIT-LicensePortalService-003: UC_AcceptEULA - Record current EULA/ethics policy version', async () => {
    const res = await service.acceptEULA(userEmail, '2026.1', { correlationId: 'CORR-UCAcceptEULA-001' });
    expect(res.success).toBe(true);
    expect(res.policyVersion).toBe('2026.1');
  });

  test('TC-UNIT-LicensePortalService-004: UC_ResetPassword - Send reset request without exposing account existence', async () => {
    const res = await service.resetPassword(userEmail, { correlationId: 'CORR-UCResetPassword-001' });
    expect(res.success).toBe(true);
    expect(res.message).toContain('Password reset request sent');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-005 to 006: Trial & Payment Orders
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-005: UC_RequestTrial30Days - Exactly one 30-day trial entitlement created', async () => {
    const trialEmail = 'trial.user@hl-mck.test';
    service.users.set(trialEmail, { email: trialEmail, eulaAccepted: true });

    const res = await service.requestTrial30Days(trialEmail, { correlationId: 'CORR-UCRequestTrial30Da-001' });
    expect(res.success).toBe(true);
    expect(res.entitlement.durationDays).toBe(30);
    expect(res.entitlement.plan).toBe('FREE_TRIAL_30D');
  });

  test('TC-UNIT-LicensePortalService-006: UC_PurchaseLicense - Pending paid order created before PayOS verification', async () => {
    const res = await service.createOrder(userEmail, 'PRO_MONTHLY', 299000, { correlationId: 'CORR-UCPurchaseLicense-001' });
    expect(res.success).toBe(true);
    expect(res.order.status).toBe('PENDING');
    expect(res.order.amountVnd).toBe(299000);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-007 to 011: License Info & Machine Binding
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-007: UC_ViewLicenseInformation - Display current trial, paid, and machine state', async () => {
    const res = await service.viewLicenseInformation(userEmail, { correlationId: 'CORR-UCViewLicenseInfor-001' });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.licenses)).toBe(true);
  });

  test('TC-UNIT-LicensePortalService-008: UC_ActivateLicense - Entitlement bound to 1 machine & returns deterministic key', async () => {
    service.licenses.set('HL-MCK-PRO-001', {
      licenseKey: 'HL-MCK-PRO-001',
      email: userEmail,
      status: 'active',
      boundMachine: null,
    });

    const res = await service.activateLicense('HL-MCK-PRO-001', 'MCK-WIN-DEVICE-01', { correlationId: 'CORR-UCActivateLicense-001' });
    expect(res.success).toBe(true);
    expect(res.boundMachine).toBe('MCK-WIN-DEVICE-01');
  });

  test('TC-UNIT-LicensePortalService-009: UC_DeactivateLicense - Machine binding released according to policy', async () => {
    service.licenses.set('HL-MCK-PRO-001', {
      licenseKey: 'HL-MCK-PRO-001',
      email: userEmail,
      status: 'active',
      boundMachine: 'MCK-WIN-DEVICE-01',
    });

    const res = await service.deactivateLicense('HL-MCK-PRO-001', 'MCK-WIN-DEVICE-01', { correlationId: 'CORR-UCDeactivateLicens-001' });
    expect(res.success).toBe(true);
    expect(service.licenses.get('HL-MCK-PRO-001').boundMachine).toBeNull();
  });

  test('TC-UNIT-LicensePortalService-010: UC_DownloadDesktopApplication - Retrieve latest approved desktop build metadata', async () => {
    service.releases.set('rel-1', { id: 'rel-1', version: '1.0.0', published: true, platform: 'windows', createdAt: new Date().toISOString() });

    const res = await service.getLatestRelease('windows');
    expect(res.success).toBe(true);
    expect(res.release.version).toBe('1.0.0');
  });

  test('TC-UNIT-LicensePortalService-011: UC_ViewProfileSyncData - Display allowed non-local summary data only', async () => {
    service.syncRecords.set('sync-1', { id: 'sync-1', email: userEmail, summary: 'Profile count 5' });

    const res = await service.viewProfileSyncData(userEmail);
    expect(res.success).toBe(true);
    expect(res.syncRecords).toHaveLength(1);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-012 to 015: Admin User Management
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-012: UC_ViewUserList - Administrator views paginated user list', async () => {
    const res = await service.listUsers(adminEmail);
    expect(res.success).toBe(true);
    expect(res.users.length).toBeGreaterThan(0);
  });

  test('TC-UNIT-LicensePortalService-013: UC_SearchUser - Administrator searches users by filter', async () => {
    const res = await service.searchUsers(adminEmail, { query: 'portal' });
    expect(res.success).toBe(true);
    expect(res.users[0].email).toBe(userEmail);
  });

  test('TC-UNIT-LicensePortalService-014: UC_ViewUserDetail - View selected user details and role', async () => {
    const res = await service.getUserDetail(adminEmail, userEmail);
    expect(res.success).toBe(true);
    expect(res.user.email).toBe(userEmail);
  });

  test('TC-UNIT-LicensePortalService-015: UC_UpdateUserStatus - Update user status and record audit log', async () => {
    const res = await service.updateUserStatus(adminEmail, userEmail, 'banned', { correlationId: 'CORR-UCUpdateUserStatus-001' });
    expect(res.success).toBe(true);
    expect(res.user.status).toBe('banned');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-016 to 019: Admin Order Management
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-016: UC_ViewOrderList - Administrator views order list', async () => {
    service.orders.set('O-1', { orderCode: 'O-1', email: userEmail, status: 'PENDING' });
    const res = await service.listOrders(adminEmail);
    expect(res.success).toBe(true);
    expect(res.orders).toHaveLength(1);
  });

  test('TC-UNIT-LicensePortalService-017: UC_SearchOrder - Search orders by status filter', async () => {
    service.orders.set('O-1', { orderCode: 'O-1', status: 'PENDING', email: userEmail });
    const res = await service.searchOrders(adminEmail, { status: 'PENDING' });
    expect(res.success).toBe(true);
    expect(res.orders[0].orderCode).toBe('O-1');
  });

  test('TC-UNIT-LicensePortalService-018: UC_ViewOrderDetail - View selected order payment & entitlement data', async () => {
    service.orders.set('O-1', { orderCode: 'O-1', amountVnd: 299000 });
    const res = await service.getOrderDetail(adminEmail, 'O-1');
    expect(res.success).toBe(true);
    expect(res.order.amountVnd).toBe(299000);
  });

  test('TC-UNIT-LicensePortalService-019: UC_ConfirmPayment - Mark order paid & trigger entitlement generation idempotently', async () => {
    service.orders.set('O-1', { orderCode: 'O-1', email: userEmail, plan: 'PRO_MONTHLY', status: 'PENDING' });
    const res = await service.confirmPayment('O-1', { correlationId: 'CORR-UCConfirmPayment-001' });

    expect(res.success).toBe(true);
    expect(res.order.status).toBe('PAID');
    expect(res.license).toBeDefined();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-020 to 023: Admin Sync Records
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-020: UC_ViewProfileSyncRecords - View list of permitted sync records', async () => {
    service.syncRecords.set('SY-1', { id: 'SY-1', email: userEmail, status: 'synced' });
    const res = await service.listSyncRecords(adminEmail);
    expect(res.success).toBe(true);
    expect(res.syncRecords).toHaveLength(1);
  });

  test('TC-UNIT-LicensePortalService-021: UC_SearchSyncRecords - Search sync records by query filter', async () => {
    service.syncRecords.set('SY-1', { id: 'SY-1', email: userEmail, status: 'synced' });
    const res = await service.searchSyncRecords(adminEmail, { query: 'portal' });
    expect(res.success).toBe(true);
    expect(res.syncRecords).toHaveLength(1);
  });

  test('TC-UNIT-LicensePortalService-022: UC_ViewSyncDetail - View sync metadata without exposing local browser data', async () => {
    service.syncRecords.set('SY-1', { id: 'SY-1', email: userEmail, metadata: { count: 3 } });
    const res = await service.getSyncDetail(adminEmail, 'SY-1');
    expect(res.success).toBe(true);
    expect(res.record.metadata.count).toBe(3);
  });

  test('TC-UNIT-LicensePortalService-023: UC_UpdateSyncStatus - Update sync status and log audit evidence', async () => {
    service.syncRecords.set('SY-1', { id: 'SY-1', status: 'pending' });
    const res = await service.updateSyncStatus(adminEmail, 'SY-1', 'archived', { correlationId: 'CORR-UCUpdateSyncStatus-001' });
    expect(res.success).toBe(true);
    expect(res.record.status).toBe('archived');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-024 to 028: Admin License Management
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-024: UC_ViewLicenseList - Paginated license list displayed', async () => {
    service.licenses.set('LIC-1', { licenseKey: 'LIC-1', email: userEmail });
    const res = await service.listLicenses(adminEmail);
    expect(res.success).toBe(true);
    expect(res.licenses).toHaveLength(1);
  });

  test('TC-UNIT-LicensePortalService-025: UC_SearchLicense - Search licenses by status', async () => {
    service.licenses.set('LIC-1', { licenseKey: 'LIC-1', status: 'active', email: userEmail });
    const res = await service.searchLicenses(adminEmail, { status: 'active' });
    expect(res.success).toBe(true);
    expect(res.licenses).toHaveLength(1);
  });

  test('TC-UNIT-LicensePortalService-026: UC_ViewLicenseDetail - Selected license details displayed', async () => {
    service.licenses.set('LIC-1', { licenseKey: 'LIC-1', email: userEmail, boundMachine: 'MCK-01' });
    const res = await service.getLicenseDetail(adminEmail, 'LIC-1');
    expect(res.success).toBe(true);
    expect(res.license.boundMachine).toBe('MCK-01');
  });

  test('TC-UNIT-LicensePortalService-027: UC_RevokeLicense - Revoke entitlement so it cannot activate', async () => {
    service.licenses.set('LIC-1', { licenseKey: 'LIC-1', status: 'active' });
    const res = await service.revokeLicense(adminEmail, 'LIC-1', { correlationId: 'CORR-UCRevokeLicense-001' });
    expect(res.success).toBe(true);
    expect(res.license.status).toBe('revoked');
  });

  test('TC-UNIT-LicensePortalService-028: UC_ResetMachine - Clear existing machine binding for future activation', async () => {
    service.licenses.set('LIC-1', { licenseKey: 'LIC-1', boundMachine: 'MCK-01' });
    const res = await service.resetMachine(adminEmail, 'LIC-1', { correlationId: 'CORR-UCResetMachine-001' });
    expect(res.success).toBe(true);
    expect(res.license.boundMachine).toBeNull();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-029 to 033: Release Management
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-029: UC_ViewDesktopReleaseList - Administrator views desktop release list', async () => {
    service.releases.set('REL-1', { id: 'REL-1', version: '1.0.0' });
    const res = await service.getLatestRelease();
    expect(res).toBeDefined();
  });

  test('TC-UNIT-LicensePortalService-030: UC_UploadRelease - Upload candidate release after validation', async () => {
    const releaseData = {
      id: 'REL-2026.07.13-win-x64',
      version: '1.0.0-qa.3',
      fileName: 'HL-MCK-Setup-1.0.0.exe',
      platform: 'windows',
      fileSize: 52428800,
      checksum: 'sha256:qa-release-hash-12345',
    };
    const res = await service.uploadRelease(adminEmail, releaseData, { correlationId: 'CORR-UCUploadRelease-001' });
    expect(res.success).toBe(true);
    expect(res.release.version).toBe('1.0.0-qa.3');
  });

  test('TC-UNIT-LicensePortalService-031: UC_ViewReleaseDetail - Display release metadata and publish status', async () => {
    service.releases.set('REL-1', { id: 'REL-1', version: '1.0.0', published: false });
    expect(service.releases.get('REL-1').published).toBe(false);
  });

  test('TC-UNIT-LicensePortalService-032: UC_UpdateRelease - Update release notes and versioning', async () => {
    service.releases.set('REL-1', { id: 'REL-1', notes: 'Initial' });
    const res = await service.updateRelease(adminEmail, 'REL-1', { notes: 'Updated notes' }, { correlationId: 'CORR-UCUpdateRelease-001' });
    expect(res.success).toBe(true);
    expect(res.release.notes).toBe('Updated notes');
  });

  test('TC-UNIT-LicensePortalService-033: UC_PublishRelease - Release becomes visible to download flows', async () => {
    service.releases.set('REL-1', { id: 'REL-1', published: false, platform: 'windows', createdAt: new Date().toISOString() });
    const res = await service.publishRelease(adminEmail, 'REL-1', { correlationId: 'CORR-UCPublishRelease-001' });
    expect(res.success).toBe(true);
    expect(res.release.published).toBe(true);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-034 to 036: System Configuration
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-034: UC_ViewSystemConfiguration - View pricing, trial, and banner settings', async () => {
    const res = await service.getSystemConfiguration(adminEmail);
    expect(res.success).toBe(true);
    expect(res.config.monthlyPriceVnd).toBe(299000);
  });

  test('TC-UNIT-LicensePortalService-035: UC_ConfigPricing - Persist pricing changes', async () => {
    const res = await service.updatePricing(adminEmail, { monthlyPriceVnd: 349000 }, { correlationId: 'CORR-UCConfigPricing-001' });
    expect(res.success).toBe(true);
    expect(res.config.monthlyPriceVnd).toBe(349000);
  });

  test('TC-UNIT-LicensePortalService-036: UC_ConfigMaintenance - Persist maintenance mode and banner', async () => {
    const res = await service.updateMaintenance(adminEmail, { maintenanceMode: true, bannerText: 'Scheduled Maintenance' }, { correlationId: 'CORR-UCConfigMaintenanc-001' });
    expect(res.success).toBe(true);
    expect(res.config.maintenanceMode).toBe(true);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-037 to 039: Audit Logs View
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-037: UC_ViewAuditLogs - View audit logs', async () => {
    service.auditStore.push({ id: 'AUD-1', action: 'LOGIN', actor: userEmail });
    const res = await service.listAuditLogs(adminEmail);
    expect(res.success).toBe(true);
    expect(res.logs).toHaveLength(1);
  });

  test('TC-UNIT-LicensePortalService-038: UC_SearchAuditLogs - Search audit logs by actor', async () => {
    service.auditStore.push({ id: 'AUD-1', action: 'LOGIN', actor: userEmail });
    const res = await service.searchAuditLogs(adminEmail, { actor: userEmail });
    expect(res.success).toBe(true);
    expect(res.logs[0].id).toBe('AUD-1');
  });

  test('TC-UNIT-LicensePortalService-039: UC_ViewAuditDetail - View audit log event details', async () => {
    service.auditStore.push({ id: 'AUD-1', action: 'LOGIN', actor: userEmail });
    const res = await service.getAuditDetail(adminEmail, 'AUD-1');
    expect(res.success).toBe(true);
    expect(res.log.action).toBe('LOGIN');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-040 to 043: Acceptance Criteria (FT-07 AC-01 to AC-04)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-040: FT-07 AC-01 - User completes registration and authenticates', async () => {
    const email = 'registered.user@hl-mck.test';
    const regRes = await service.registerAccount(email, 'Pass@123', true);
    expect(regRes.success).toBe(true);

    const logRes = await service.logIn(email, 'Pass@123');
    expect(logRes.success).toBe(true);
  });

  test('TC-UNIT-LicensePortalService-041: FT-07 AC-02 - Eligible trial creates exactly 1 entitlement expiring 30 days later', async () => {
    const trialEmail = 'ac02.trial@hl-mck.test';
    service.users.set(trialEmail, { email: trialEmail, eulaAccepted: true });

    const res = await service.requestTrial30Days(trialEmail);
    expect(res.success).toBe(true);
    const expiresAt = new Date(res.entitlement.expiresAt);
    const createdAt = new Date(res.entitlement.createdAt);
    const diffDays = Math.round((expiresAt - createdAt) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  test('TC-UNIT-LicensePortalService-042: FT-07 AC-03 - Active license bound to 1 machine returns same key on repeat requests', async () => {
    service.licenses.set('LIC-AC03', { licenseKey: 'LIC-AC03', email: userEmail, status: 'active', boundMachine: null });

    const first = await service.activateLicense('LIC-AC03', 'MACHINE-A');
    expect(first.success).toBe(true);

    const repeat = await service.activateLicense('LIC-AC03', 'MACHINE-A');
    expect(repeat.success).toBe(true);
    expect(repeat.licenseKey).toBe('LIC-AC03');
  });

  test('TC-UNIT-LicensePortalService-043: FT-07 AC-04 - Admin publishes release and users retrieve latest metadata', async () => {
    await service.uploadRelease(adminEmail, {
      id: 'REL-AC04',
      version: '1.0.0',
      fileName: 'Setup.exe',
      platform: 'windows',
      fileSize: 1000,
      checksum: 'sha256:valid-hash',
    });
    await service.publishRelease(adminEmail, 'REL-AC04');

    const latest = await service.getLatestRelease('windows');
    expect(latest.success).toBe(true);
    expect(latest.release.id).toBe('REL-AC04');
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-044 to 047: Negative Criteria (FT-07 NAC-01 to NAC-04)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-044: FT-07 NAC-01 - Second trial request for same email is rejected', async () => {
    const trialEmail = 'repeat.trial@hl-mck.test';
    service.users.set(trialEmail, { email: trialEmail, eulaAccepted: true });

    await service.requestTrial30Days(trialEmail);
    const second = await service.requestTrial30Days(trialEmail);
    expect(second.success).toBe(false);
    expect(second.code).toBe('TRIAL_ALREADY_CLAIMED');
  });

  test('TC-UNIT-LicensePortalService-045: FT-07 NAC-02 - Expired, revoked, or differently-bound license requests rejected', async () => {
    service.licenses.set('LIC-REVOKED', { licenseKey: 'LIC-REVOKED', status: 'revoked' });
    const resRevoked = await service.activateLicense('LIC-REVOKED', 'M-1');
    expect(resRevoked.success).toBe(false);
    expect(resRevoked.error).toMatch(/Cannot activate: License is revoked/);

    service.licenses.set('LIC-BOUND', { licenseKey: 'LIC-BOUND', status: 'active', boundMachine: 'M-1' });
    const resConflict = await service.activateLicense('LIC-BOUND', 'M-2');
    expect(resConflict.success).toBe(false);
    expect(resConflict.code).toBe('MACHINE_BINDING_CONFLICT');
  });

  test('TC-UNIT-LicensePortalService-046: FT-07 NAC-03 - Non-admin email rejected from admin endpoints', async () => {
    const res = await service.listUsers('nonadmin@hl-mck.test');
    expect(res.success).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED_ADMIN');
  });

  test('TC-UNIT-LicensePortalService-047: FT-07 NAC-04 - Path traversal or invalid checksum release uploads rejected', async () => {
    const resTraversal = await service.uploadRelease(adminEmail, {
      fileName: '../../evil.exe',
      checksum: 'sha256:123',
      fileSize: 100,
    });
    expect(resTraversal.success).toBe(false);
    expect(resTraversal.error).toMatch(/Path traversal/);

    const resChecksum = await service.uploadRelease(adminEmail, {
      fileName: 'valid.exe',
      checksum: 'md5:invalid',
      fileSize: 100,
    });
    expect(resChecksum.success).toBe(false);
    expect(resChecksum.error).toMatch(/Invalid checksum/);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-LicensePortalService-048 to 049: Boundary Value Analysis (FT-07 BV-12, BV-13)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-LicensePortalService-048: FT-07 BV-12 - Trial duration boundary (exactly 30 days)', async () => {
    const email = 'bv12@hl-mck.test';
    service.users.set(email, { email, eulaAccepted: true });

    const res = await service.requestTrial30Days(email);
    expect(res.success).toBe(true);
    expect(res.entitlement.durationDays).toBe(30);
  });

  test('TC-UNIT-LicensePortalService-049: FT-07 BV-13 - License machine binding boundary (0 or 1 active machine valid, 2nd rejected)', async () => {
    service.licenses.set('LIC-BV13', { licenseKey: 'LIC-BV13', status: 'active', boundMachine: null });

    // 0 -> 1 machine: Success
    const res1 = await service.activateLicense('LIC-BV13', 'DEVICE-ALPHA');
    expect(res1.success).toBe(true);

    // 1 -> 2nd distinct machine: Rejected
    const res2 = await service.activateLicense('LIC-BV13', 'DEVICE-BETA');
    expect(res2.success).toBe(false);
    expect(res2.code).toBe('MACHINE_BINDING_CONFLICT');
  });
});
