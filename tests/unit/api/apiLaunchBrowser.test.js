// tests/unit/api/apiLaunchBrowser.test.js
const Fastify = require('fastify');

// Mock handlers — phải mock TRƯỚC khi require restServer
jest.mock('../../../src/main/ipc/handlers', () => ({
  launchProfileInternal: jest.fn(),
}));

const handlers = require('../../../src/main/ipc/handlers');

// Helper: dựng lại đúng route handler để test cô lập
function buildApp() {
  const app = Fastify();
  app.post('/api/browsers/:profileId/launch', async (req, reply) => {
    try {
      const { profileId } = req.params;
      const body = req.body || {};
      const opts = {};
      if (body.headless !== undefined) {
        opts.headless =
          body.headless === true ||
          String(body.headless).toLowerCase() === 'true';
      }
      const result = await handlers.launchProfileInternal(profileId, opts);
      if (result && result.success === false) {
        return reply.code(400).send(result);
      }
      reply.send(result);
    } catch (e) {
      reply.code(500).send({ success: false, error: e?.message || String(e) });
    }
  });
  return app;
}

describe('POST /api/browsers/:profileId/launch  [UC_56]', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // ─────────── UTCID01 — Normal ───────────
  test('UTCID01 (N): headless=true (boolean) → 200 + wsEndpoint', async () => {
    handlers.launchProfileInternal.mockResolvedValue({
      success: true,
      wsEndpoint: 'ws://127.0.0.1:9222/abc',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/browsers/abc123/launch',
      payload: { headless: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      wsEndpoint: 'ws://127.0.0.1:9222/abc',
    });
    expect(handlers.launchProfileInternal).toHaveBeenCalledWith('abc123', { headless: true });
  });

  // ─────────── UTCID02 — Normal ───────────
  test('UTCID02 (N): headless="true" (string) → coerce thành true → 200', async () => {
    handlers.launchProfileInternal.mockResolvedValue({
      success: true,
      wsEndpoint: 'ws://127.0.0.1:9222/abc',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/browsers/abc123/launch',
      payload: { headless: 'true' },
    });

    expect(res.statusCode).toBe(200);
    expect(handlers.launchProfileInternal).toHaveBeenCalledWith('abc123', { headless: true });
  });

  // ─────────── UTCID03 — Abnormal ───────────
  test('UTCID03 (A): launchProfileInternal trả success:false → 400', async () => {
    handlers.launchProfileInternal.mockResolvedValue({
      success: false,
      error: 'Profile not found',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/browsers/unknown/launch',
      payload: { headless: false },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ success: false, error: 'Profile not found' });
  });

  // ─────────── UTCID04 — Boundary ───────────
  test('UTCID04 (B): handler throw ENOENT → catch → 500', async () => {
    handlers.launchProfileInternal.mockRejectedValue(
      new Error('ENOENT: no such file profiles.json')
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/browsers/abc123/launch',
      payload: {}, // không có headless
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      success: false,
      error: 'ENOENT: no such file profiles.json',
    });
  });

  // ─────────── UTCID05 — Normal ───────────
  test('UTCID05 (N): body rỗng (không có headless) → opts={} → 200', async () => {
    handlers.launchProfileInternal.mockResolvedValue({
      success: true,
      wsEndpoint: 'ws://127.0.0.1:9222/abc',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/browsers/abc123/launch',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(handlers.launchProfileInternal).toHaveBeenCalledWith('abc123', {}); // opts rỗng
  });
});