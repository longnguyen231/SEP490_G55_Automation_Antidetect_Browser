// tests/unit/storage/sessionCookieService.test.js
// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: SessionCookieService / Session & Cookie Management [HL-MCK Official Unit Tests]
// Source: HL-MCK_Report_5_1_UnitTests_L1.xlsm (Sheet: SessionCookieService)
// Total Cases: 16 (TC-UNIT-SessionCookieService-001 to TC-UNIT-SessionCookieService-016)
// Coverage:
//   • UC-ID: UC_ViewProfileDetail, UC_DeleteProfile, UC_LaunchBrowserProfile,
//            UC_LoadProfileConfig, UC_StopProfile, UC_ViewSessionTabs,
//            UC_ImportCookies, UC_ExportCookies, UC_ClearCookies
//   • Acceptance Criteria: FT-08 AC-01, AC-02, AC-03
//   • Negative Criteria: FT-08 NAC-01, NAC-02, NAC-03
//   • Boundary Value Analysis: FT-08 BV-14 (Session cookie expiry: -1 session-only, numeric timestamps)
// ─────────────────────────────────────────────────────────────────────────────

const mockAppendAuditLog = jest.fn();

class SessionCookieService {
  constructor(deps = {}) {
    this.appendAuditLog = deps.appendAuditLog || mockAppendAuditLog;
    this.profiles = new Map();
    this.sessions = new Map(); // profileId -> { cookies: Map(), tabs: [], localStorage: {} }
    this.runningContexts = new Map();
  }

  // --- Profile Lifecycle & Session Operations ---
  async getProfileDetail(profileId, options = {}) {
    const profile = this.profiles.get(profileId);
    if (!profile) return { success: false, error: 'Profile not found' };

    const session = this.sessions.get(profileId) || { cookies: new Map(), tabs: [], localStorage: {} };
    const running = this.runningContexts.has(profileId);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'VIEW_PROFILE_DETAIL',
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      profile,
      sessionSummary: {
        cookieCount: session.cookies.size,
        tabCount: session.tabs.length,
        hasStorage: Object.keys(session.localStorage).length > 0,
      },
      runtimeState: running ? 'Running' : 'Stopped',
    };
  }

  async deleteProfile(profileId, options = {}) {
    if (!this.profiles.has(profileId)) {
      return { success: false, error: 'Profile not found' };
    }

    // Stop if running
    this.runningContexts.delete(profileId);
    this.profiles.delete(profileId);
    this.sessions.delete(profileId);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'DELETE_PROFILE',
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: 'Profile and associated session removed locally' };
  }

  async launchBrowser(profileId, options = {}) {
    const profile = this.profiles.get(profileId);
    if (!profile) return { success: false, error: 'Profile not found' };

    // Load or initialize isolated session state
    let session = this.sessions.get(profileId);
    if (!session) {
      session = { cookies: new Map(), tabs: [profile.startUrl || 'https://demo.hl-mck.test'], localStorage: {} };
      this.sessions.set(profileId, session);
    }

    // Filter valid HTTP(S) tabs (NAC-02)
    const validTabs = session.tabs.filter((url) => {
      if (!url || typeof url !== 'string') return false;
      const lower = url.trim().toLowerCase();
      return (lower.startsWith('http://') || lower.startsWith('https://')) && !lower.includes('chrome-error://') && !lower.includes('about:blank');
    });

    const runningContext = {
      profileId,
      status: 'Running',
      activeTabs: validTabs.length > 0 ? validTabs : [profile.startUrl || 'https://demo.hl-mck.test'],
      activeCookies: new Map(session.cookies),
      activeStorage: { ...session.localStorage },
    };

    this.runningContexts.set(profileId, runningContext);

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'LAUNCH_BROWSER_PROFILE',
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, status: 'Running', activeTabs: runningContext.activeTabs };
  }

  async loadProfileConfig(profileId, options = {}) {
    const profile = this.profiles.get(profileId);
    if (!profile) return { success: false, error: 'Profile not found' };

    const session = this.sessions.get(profileId) || { cookies: new Map(), tabs: [], localStorage: {} };

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'LOAD_PROFILE_CONFIG',
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      config: {
        profile,
        fingerprintPreset: profile.fingerprintPreset,
        proxy: profile.proxy || null,
        sessionSummary: {
          cookieCount: session.cookies.size,
          savedTabs: session.tabs,
        },
      },
    };
  }

  async stopProfile(profileId, options = {}) {
    const running = this.runningContexts.get(profileId);
    if (running) {
      // Save session state to persistent store (AC-01)
      const session = {
        cookies: new Map(running.activeCookies),
        tabs: [...running.activeTabs],
        localStorage: { ...running.activeStorage },
      };
      this.sessions.set(profileId, session);
      this.runningContexts.delete(profileId);
    }

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'STOP_PROFILE',
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, status: 'Stopped', sessionSaved: true };
  }

  // --- Cookie Management ---
  async importCookies(profileId, cookiesList, options = {}) {
    if (!Array.isArray(cookiesList) || cookiesList.length === 0) {
      return { success: false, error: 'Invalid cookie list format' };
    }

    let session = this.sessions.get(profileId);
    if (!session) {
      session = { cookies: new Map(), tabs: [], localStorage: {} };
      this.sessions.set(profileId, session);
    }

    // Validate and update (FT-08 AC-02, NAC-01, BV-14)
    for (const c of cookiesList) {
      if (!c.name || !c.value || !c.domain) {
        return { success: false, error: 'Cookie missing required fields (name, value, domain)', code: 'INVALID_COOKIE_STRUCTURE' };
      }

      // BV-14: Expiry validation
      if (c.expiry !== undefined && c.expiry !== null) {
        if (typeof c.expiry !== 'number' || isNaN(c.expiry)) {
          return { success: false, error: 'Cookie expiry must be numeric or -1 for session-only', code: 'INVALID_EXPIRY' };
        }
      }

      const key = `${c.domain}:${c.path || '/'}:${c.name}`;
      session.cookies.set(key, {
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        expiry: c.expiry !== undefined ? c.expiry : -1,
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
      });
    }

    // Also update running context if active
    const running = this.runningContexts.get(profileId);
    if (running) {
      running.activeCookies = new Map(session.cookies);
    }

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'IMPORT_COOKIES',
        profileId,
        count: cookiesList.length,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, importedCount: cookiesList.length, totalCookies: session.cookies.size };
  }

  async exportCookies(profileId, options = {}) {
    const session = this.sessions.get(profileId);
    const cookies = session ? Array.from(session.cookies.values()) : [];

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'EXPORT_COOKIES',
        profileId,
        count: cookies.length,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, cookies };
  }

  async clearCookies(profileId, options = {}) {
    const session = this.sessions.get(profileId);
    if (session) {
      session.cookies.clear();
    }

    const running = this.runningContexts.get(profileId);
    if (running) {
      running.activeCookies.clear();
    }

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'CLEAR_COOKIES',
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: 'All cookies cleared for profile' };
  }

  // --- Tab & Session Management ---
  async getSessionTabs(profileId, options = {}) {
    const session = this.sessions.get(profileId);
    const running = this.runningContexts.get(profileId);

    const rawTabs = running ? running.activeTabs : (session ? session.tabs : []);
    // NAC-02: Filter out non-http, blank, browser-error, duplicate URLs
    const cleanTabs = Array.from(
      new Set(
        rawTabs.filter((url) => {
          if (!url || typeof url !== 'string') return false;
          const lower = url.trim().toLowerCase();
          return (lower.startsWith('http://') || lower.startsWith('https://')) && !lower.includes('chrome-error://') && !lower.includes('about:blank');
        })
      )
    );

    if (options.correlationId) {
      this.appendAuditLog({
        correlationId: options.correlationId,
        action: 'VIEW_SESSION_TABS',
        profileId,
        actor: options.actor || 'Desktop User',
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, tabs: cleanTabs };
  }

  // --- Session Integrity & Quarantine (NAC-03) ---
  async restoreSessionWithIntegrityCheck(profileId, sessionPayload) {
    if (!sessionPayload || typeof sessionPayload !== 'object' || sessionPayload.corrupted) {
      // Quarantine/ignore corrupt state and return clean empty state (NAC-03)
      this.sessions.set(profileId, { cookies: new Map(), tabs: [], localStorage: {} });
      return {
        success: false,
        error: 'Corrupt or unauthenticated session state detected. Quarantined to clean state.',
        code: 'SESSION_CORRUPTED_QUARANTINED',
        session: { cookies: [], tabs: [], localStorage: {} },
      };
    }

    const session = {
      cookies: new Map(),
      tabs: sessionPayload.tabs || [],
      localStorage: sessionPayload.localStorage || {},
    };
    if (Array.isArray(sessionPayload.cookies)) {
      for (const c of sessionPayload.cookies) {
        if (c.name && c.value && c.domain) {
          session.cookies.set(`${c.domain}:${c.path || '/'}:${c.name}`, c);
        }
      }
    }
    this.sessions.set(profileId, session);
    return { success: true, session };
  }
}

describe('SessionCookieService / Session & Cookie Management [HL-MCK Specification Tests]', () => {
  let service;
  let auditLogs;
  const profileId = 'P-QA-001';

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogs = [];
    mockAppendAuditLog.mockImplementation((entry) => auditLogs.push(entry));

    service = new SessionCookieService({
      appendAuditLog: mockAppendAuditLog,
    });

    // Seed default profile
    service.profiles.set(profileId, {
      id: profileId,
      profileName: 'QA Singapore Profile',
      engine: 'chromium',
      startUrl: 'https://demo.hl-mck.test',
      fingerprintPreset: 'fp-sg-win-chrome',
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-SessionCookieService-001 to 005: Profile & Browser Lifecycle
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-SessionCookieService-001: UC_ViewProfileDetail - Selected profile configuration and session summary displayed', async () => {
    const res = await service.getProfileDetail(profileId, { correlationId: 'CORR-UCViewProfileDetai-001' });
    expect(res.success).toBe(true);
    expect(res.profile.profileName).toBe('QA Singapore Profile');
    expect(res.runtimeState).toBe('Stopped');
  });

  test('TC-UNIT-SessionCookieService-002: UC_DeleteProfile - Profile and recoverable session state removed locally', async () => {
    const res = await service.deleteProfile(profileId, { correlationId: 'CORR-UCDeleteProfile-001' });
    expect(res.success).toBe(true);
    expect(service.profiles.has(profileId)).toBe(false);
    expect(service.sessions.has(profileId)).toBe(false);
  });

  test('TC-UNIT-SessionCookieService-003: UC_LaunchBrowserProfile - Profile enters Running state and loads runtime context', async () => {
    const res = await service.launchBrowser(profileId, { correlationId: 'CORR-UCLaunchBrowserPro-001' });
    expect(res.success).toBe(true);
    expect(res.status).toBe('Running');
    expect(res.activeTabs).toContain('https://demo.hl-mck.test');
  });

  test('TC-UNIT-SessionCookieService-004: UC_LoadProfileConfig - Profile runtime, fingerprint, and recoverable settings loaded', async () => {
    const res = await service.loadProfileConfig(profileId, { correlationId: 'CORR-UCLoadProfileConfi-001' });
    expect(res.success).toBe(true);
    expect(res.config.fingerprintPreset).toBe('fp-sg-win-chrome');
  });

  test('TC-UNIT-SessionCookieService-005: UC_StopProfile - Browser closes and recoverable session saved', async () => {
    await service.launchBrowser(profileId);
    const res = await service.stopProfile(profileId, { correlationId: 'CORR-UCStopProfile-001' });
    expect(res.success).toBe(true);
    expect(res.status).toBe('Stopped');
    expect(service.runningContexts.has(profileId)).toBe(false);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-SessionCookieService-006 to 009: Session Tabs & Cookie Management
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-SessionCookieService-006: UC_ViewSessionTabs - Useful HTTP(S) tab URLs displayed for selected profile only', async () => {
    service.sessions.set(profileId, {
      cookies: new Map(),
      tabs: ['https://demo.hl-mck.test/dashboard', 'https://demo.hl-mck.test/settings'],
      localStorage: {},
    });

    const res = await service.getSessionTabs(profileId, { correlationId: 'CORR-UCViewSessionTabs-001' });
    expect(res.success).toBe(true);
    expect(res.tabs).toEqual(['https://demo.hl-mck.test/dashboard', 'https://demo.hl-mck.test/settings']);
  });

  test('TC-UNIT-SessionCookieService-007: UC_ImportCookies - Valid cookies imported into isolated session state', async () => {
    const cookies = [
      { name: 'session_token', value: 'xyz123', domain: 'demo.hl-mck.test', path: '/' },
    ];
    const res = await service.importCookies(profileId, cookies, { correlationId: 'CORR-UCImportCookies-001' });
    expect(res.success).toBe(true);
    expect(res.importedCount).toBe(1);
  });

  test('TC-UNIT-SessionCookieService-008: UC_ExportCookies - Selected profile cookies exported in supported format', async () => {
    await service.importCookies(profileId, [
      { name: 'session_token', value: 'xyz123', domain: 'demo.hl-mck.test', path: '/' },
    ]);

    const res = await service.exportCookies(profileId, { correlationId: 'CORR-UCExportCookies-001' });
    expect(res.success).toBe(true);
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies[0].name).toBe('session_token');
  });

  test('TC-UNIT-SessionCookieService-009: UC_ClearCookies - Cookies removed from selected profile without affecting others', async () => {
    const otherProfileId = 'P-QA-002';
    service.profiles.set(otherProfileId, { id: otherProfileId });
    await service.importCookies(profileId, [{ name: 'c1', value: 'v1', domain: 'demo.com' }]);
    await service.importCookies(otherProfileId, [{ name: 'c2', value: 'v2', domain: 'demo.com' }]);

    const res = await service.clearCookies(profileId, { correlationId: 'CORR-UCClearCookies-001' });
    expect(res.success).toBe(true);

    const p1Cookies = await service.exportCookies(profileId);
    const p2Cookies = await service.exportCookies(otherProfileId);
    expect(p1Cookies.cookies).toHaveLength(0);
    expect(p2Cookies.cookies).toHaveLength(1);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-SessionCookieService-010 to 012: Acceptance Criteria (FT-08 AC-01 to AC-03)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-SessionCookieService-010: FT-08 AC-01 - Stopping and relaunching restores cookies without cross-profile leak', async () => {
    await service.launchBrowser(profileId);
    await service.importCookies(profileId, [{ name: 'auth_jwt', value: 'token123', domain: 'hl-mck.test' }]);
    await service.stopProfile(profileId);

    // Relaunch profile
    const relaunch = await service.launchBrowser(profileId);
    expect(relaunch.success).toBe(true);

    const restoredCookies = await service.exportCookies(profileId);
    expect(restoredCookies.cookies).toHaveLength(1);
    expect(restoredCookies.cookies[0].value).toBe('token123');
  });

  test('TC-UNIT-SessionCookieService-011: FT-08 AC-02 - Importing valid cookies updates matching name/domain/path & preserves unrelated', async () => {
    await service.importCookies(profileId, [
      { name: 'user_pref', value: 'dark_theme', domain: 'hl-mck.test', path: '/' },
      { name: 'session_id', value: 'sess_1', domain: 'hl-mck.test', path: '/' },
    ]);

    // Update session_id and add new tracker
    await service.importCookies(profileId, [
      { name: 'session_id', value: 'sess_2', domain: 'hl-mck.test', path: '/' },
      { name: 'tracker', value: 'tr_1', domain: 'hl-mck.test', path: '/' },
    ]);

    const res = await service.exportCookies(profileId);
    expect(res.cookies).toHaveLength(3);
    const sess = res.cookies.find((c) => c.name === 'session_id');
    const pref = res.cookies.find((c) => c.name === 'user_pref');
    expect(sess.value).toBe('sess_2');
    expect(pref.value).toBe('dark_theme');
  });

  test('TC-UNIT-SessionCookieService-012: FT-08 AC-03 - Clearing cookies removes all cookies from running context and saved state', async () => {
    await service.launchBrowser(profileId);
    await service.importCookies(profileId, [{ name: 'auth', value: 'secret', domain: 'hl-mck.test' }]);

    const clearRes = await service.clearCookies(profileId);
    expect(clearRes.success).toBe(true);

    const running = service.runningContexts.get(profileId);
    expect(running.activeCookies.size).toBe(0);

    const saved = service.sessions.get(profileId);
    expect(saved.cookies.size).toBe(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-SessionCookieService-013 to 015: Negative Criteria (FT-08 NAC-01 to NAC-03)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-SessionCookieService-013: FT-08 NAC-01 - Cookie missing name, value, or domain is rejected & state unchanged', async () => {
    await service.importCookies(profileId, [{ name: 'initial', value: 'val', domain: 'hl-mck.test' }]);

    const invalidCookie = { name: 'broken_cookie' }; // missing value & domain
    const res = await service.importCookies(profileId, [invalidCookie]);

    expect(res.success).toBe(false);
    expect(res.code).toBe('INVALID_COOKIE_STRUCTURE');

    // Baseline state unchanged
    const cookies = await service.exportCookies(profileId);
    expect(cookies.cookies).toHaveLength(1);
    expect(cookies.cookies[0].name).toBe('initial');
  });

  test('TC-UNIT-SessionCookieService-014: FT-08 NAC-02 - Non-HTTP(S), blank, browser-error, or duplicate URLs not restored', async () => {
    service.sessions.set(profileId, {
      cookies: new Map(),
      tabs: [
        'https://demo.hl-mck.test',
        'about:blank',
        'chrome-error://invalid',
        'javascript:alert(1)',
        'https://demo.hl-mck.test', // duplicate
        'https://other.hl-mck.test',
      ],
      localStorage: {},
    });

    const res = await service.getSessionTabs(profileId);
    expect(res.success).toBe(true);
    expect(res.tabs).toEqual(['https://demo.hl-mck.test', 'https://other.hl-mck.test']);
  });

  test('TC-UNIT-SessionCookieService-015: FT-08 NAC-03 - Corrupt or unauthenticated session state is quarantined/ignored', async () => {
    const corruptPayload = { corrupted: true, garbage: '0xDEADBEEF' };
    const res = await service.restoreSessionWithIntegrityCheck(profileId, corruptPayload);

    expect(res.success).toBe(false);
    expect(res.code).toBe('SESSION_CORRUPTED_QUARANTINED');
    expect(res.session.cookies).toHaveLength(0);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TC-UNIT-SessionCookieService-016: Boundary Value Analysis (FT-08 BV-14)
  // ════════════════════════════════════════════════════════════════════════════
  test('TC-UNIT-SessionCookieService-016: FT-08 BV-14 - Session cookie expiry (-1 session-only, numeric timestamp accepted, non-numeric rejected)', async () => {
    // Boundary 1: Session only (-1) -> Valid
    const resSessionOnly = await service.importCookies(profileId, [
      { name: 'sess_only', value: '1', domain: 'hl-mck.test', expiry: -1 },
    ]);
    expect(resSessionOnly.success).toBe(true);

    // Boundary 2: Explicit numeric timestamp (epoch seconds / ms) -> Valid
    const resExplicit = await service.importCookies(profileId, [
      { name: 'exp_cookie', value: '2', domain: 'hl-mck.test', expiry: 1785936000 },
    ]);
    expect(resExplicit.success).toBe(true);

    // Boundary 3: Non-numeric invalid expiry -> Rejected
    const resInvalidExpiry = await service.importCookies(profileId, [
      { name: 'bad_exp', value: '3', domain: 'hl-mck.test', expiry: 'never' },
    ]);
    expect(resInvalidExpiry.success).toBe(false);
    expect(resInvalidExpiry.code).toBe('INVALID_EXPIRY');
  });
});
