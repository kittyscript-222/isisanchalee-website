// tests/intake.test.js
// Tests for api/intake.js — specifically the admin portal sync added in the
// client management system. The core Stripe/email/sheets logic is tested
// elsewhere; these tests focus on:
//
//   - Admin portal webhook called with formType: 'rtt_intake' when ADMIN_PORTAL_URL is set
//   - Webhook receives the correct client fields (name, email, focus, etc.)
//   - Correct WEBHOOK_SECRET header is forwarded
//   - Admin webhook call is non-fatal: handler still returns 200 if fetch throws
//   - Admin webhook is NOT called when ADMIN_PORTAL_URL is unset

const test = require('node:test');
const assert = require('node:assert/strict');
const { setMocks, clearMocks } = require('./mock-require');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

function makeReq(body = {}) {
  return { method: 'POST', body };
}

// Standard successful Stripe session mock
function makeFakeStripe({ paid = true } = {}) {
  return function FakeStripe() {
    return {
      checkout: {
        sessions: {
          retrieve: async () => ({
            payment_status: paid ? 'paid' : 'unpaid',
            customer_details: { email: 'halo@test.com' },
          }),
        },
      },
    };
  };
}

function makeHttps() {
  return {
    request(options, callback) {
      const fakeRes = { statusCode: 302, resume() {} };
      callback(fakeRes);
      return { write() {}, end() {}, on() {} };
    },
  };
}

function freshIntakeModule() {
  delete require.cache[require.resolve('../api/intake.js')];
  delete require.cache[require.resolve('../lib/email.js')];
  setMocks({
    stripe: makeFakeStripe(),
    https: makeHttps(),
    '../lib/email': {
      sendSessionConfirmation: async () => {},
      notifyIntakeReceived: async () => {},
    },
    '../lib/sheets': {
      logConsentRecord: async () => {},
    },
  });
  return require('../api/intake.js');
}

// ── Admin portal webhook tests ────────────────────────────────────────────────

test('calls admin portal webhook with formType rtt_intake when ADMIN_PORTAL_URL is set', async () => {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    return { ok: true, json: async () => ({ success: true, client_id: 'uuid-1' }) };
  };

  process.env.ADMIN_PORTAL_URL = 'https://admin.test';
  process.env.WEBHOOK_SECRET = 'test-secret';

  const handler = freshIntakeModule();
  const res = makeRes();
  await handler(makeReq({
    name: 'Halo',
    email: 'halo@test.com',
    phone: '555-1234',
    focus: 'self-worth',
    manifestation: 'freedom',
    outcome: 'clarity',
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(fetchCalls.length, 1, 'should call admin portal webhook exactly once');
  assert.equal(fetchCalls[0].url, 'https://admin.test/api/client-intake');
  assert.equal(fetchCalls[0].body.formType, 'rtt_intake');
  assert.equal(fetchCalls[0].body.name, 'Halo');
  assert.equal(fetchCalls[0].body.focus, 'self-worth');
  assert.equal(fetchCalls[0].headers['x-webhook-secret'], 'test-secret');

  global.fetch = originalFetch;
  delete process.env.ADMIN_PORTAL_URL;
  delete process.env.WEBHOOK_SECRET;
  clearMocks();
});

test('webhook call includes clientEmail resolved from form (not just body.email)', async () => {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({}) };
  };

  process.env.ADMIN_PORTAL_URL = 'https://admin.test';
  process.env.WEBHOOK_SECRET = 'secret';

  // intake.js resolves clientEmail from body.email first
  const handler = freshIntakeModule();
  const res = makeRes();
  await handler(makeReq({ name: 'Halo', email: 'fromform@test.com', focus: 'blocks' }), res);

  assert.equal(fetchCalls[0].email, 'fromform@test.com');

  global.fetch = originalFetch;
  delete process.env.ADMIN_PORTAL_URL;
  delete process.env.WEBHOOK_SECRET;
  clearMocks();
});

test('admin webhook call is non-fatal: returns 200 even if fetch throws', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Network unreachable'); };

  process.env.ADMIN_PORTAL_URL = 'https://admin.test';

  const handler = freshIntakeModule();
  const res = makeRes();
  await assert.doesNotReject(handler(makeReq({ name: 'Halo', email: 'halo@test.com' }), res));
  assert.equal(res.statusCode, 200, 'form should still succeed when admin webhook fails');

  global.fetch = originalFetch;
  delete process.env.ADMIN_PORTAL_URL;
  clearMocks();
});

test('admin webhook is not called when ADMIN_PORTAL_URL is not set', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push(url);
    return { ok: true, json: async () => ({}) };
  };

  const handler = freshIntakeModule();
  const res = makeRes();
  await handler(makeReq({ name: 'Halo', email: 'halo@test.com' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(fetchCalls.length, 0, 'fetch should not be called without ADMIN_PORTAL_URL');

  global.fetch = originalFetch;
  clearMocks();
});

test('admin webhook call includes all intake fields', async () => {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({}) };
  };

  process.env.ADMIN_PORTAL_URL = 'https://admin.test';
  process.env.WEBHOOK_SECRET = 'secret';

  const handler = freshIntakeModule();
  const res = makeRes();
  await handler(makeReq({
    name: 'Halo',
    email: 'halo@test.com',
    phone: '555-9999',
    focus: 'abundance',
    manifestation: 'financial freedom',
    duration: '5 years',
    childhood: 'scarcity',
    outcome: 'release blocks',
    previous: 'CBT',
    medical: 'none',
    hypno: 'yes',
    extra: 'notes here',
  }), res);

  const payload = fetchCalls[0];
  assert.equal(payload.formType, 'rtt_intake');
  assert.equal(payload.phone, '555-9999');
  assert.equal(payload.manifestation, 'financial freedom');
  assert.equal(payload.previous, 'CBT');
  assert.equal(payload.hypno, 'yes');

  global.fetch = originalFetch;
  delete process.env.ADMIN_PORTAL_URL;
  delete process.env.WEBHOOK_SECRET;
  clearMocks();
});

// ── Existing behaviour regression ──────────────────────────────────────────────

test('returns 200 on a standard valid intake submission', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  const handler = freshIntakeModule();
  const res = makeRes();
  await handler(makeReq({ name: 'Halo', email: 'halo@test.com', focus: 'clarity' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  clearMocks();
});

test('returns 402 when Stripe payment is not paid', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  clearMocks();
  setMocks({
    stripe: makeFakeStripe({ paid: false }),
    https: makeHttps(),
    '../lib/email': { sendSessionConfirmation: async () => {}, notifyIntakeReceived: async () => {} },
    '../lib/sheets': { logConsentRecord: async () => {} },
  });
  delete require.cache[require.resolve('../api/intake.js')];
  const handler = require('../api/intake.js');

  const res = makeRes();
  await handler(makeReq({ sessionId: 'cs_test_unpaid', name: 'Halo', email: 'halo@test.com' }), res);
  assert.equal(res.statusCode, 402);
  clearMocks();
});

test('rejects non-POST methods with 405', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  const handler = freshIntakeModule();
  const res = makeRes();
  await handler({ method: 'GET', body: {} }, res);
  assert.equal(res.statusCode, 405);
  clearMocks();
});
