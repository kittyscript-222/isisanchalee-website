// tests/mentorship.test.js
// Tests for api/mentorship-application.js — specifically the admin portal sync.
//
// Verifies:
//   - Admin portal webhook called with formType: 'mentorship' when ADMIN_PORTAL_URL is set
//   - Correct fields (birth data, vision, etc.) forwarded to webhook
//   - Non-fatal: form returns 200 even if admin fetch throws
//   - No fetch call when ADMIN_PORTAL_URL is unset
//   - Existing behaviour: 400 when email missing; 200 on valid submission

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

function makeHttps() {
  return {
    request(options, callback) {
      callback({ statusCode: 302, resume() {} });
      return { write() {}, end() {}, on() {} };
    },
  };
}

function freshMentorshipModule() {
  delete require.cache[require.resolve('../api/mentorship-application.js')];
  delete require.cache[require.resolve('../lib/email.js')];
  setMocks({
    https: makeHttps(),
    '../lib/email': {
      sendMentorshipApplicationConfirmation: async () => {},
      notifyMentorshipApplicationReceived: async () => {},
    },
  });
  return require('../api/mentorship-application.js');
}

const VALID_BODY = {
  name: 'Halo',
  email: 'halo@test.com',
  dobYear: '1990',
  dobMonth: '3',
  dobDay: '14',
  birthTime: '08:30',
  birthPlace: 'London, UK',
  currentReality: 'building a soulful business',
  dharmicVision: 'teach, heal, create',
  innerWork: 'RTT, meditation',
  hopes: 'expand my dharmic path',
  practiceYN: 'yes',
  practiceDetails: 'daily Vedic meditation',
  readiness: 'fully ready',
  investment: 'yes',
};

// ── Admin portal webhook tests ────────────────────────────────────────────────

test('calls admin portal webhook with formType mentorship when ADMIN_PORTAL_URL is set', async () => {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, body: JSON.parse(opts.body), headers: opts.headers });
    return { ok: true, json: async () => ({ success: true }) };
  };

  process.env.ADMIN_PORTAL_URL = 'https://admin.test';
  process.env.WEBHOOK_SECRET = 'test-secret';

  const handler = freshMentorshipModule();
  const res = makeRes();
  await handler(makeReq(VALID_BODY), res);

  assert.equal(res.statusCode, 200);
  assert.equal(fetchCalls.length, 1, 'admin webhook should be called once');
  assert.equal(fetchCalls[0].url, 'https://admin.test/api/client-intake');
  assert.equal(fetchCalls[0].body.formType, 'mentorship');
  assert.equal(fetchCalls[0].body.name, 'Halo');
  assert.equal(fetchCalls[0].body.email, 'halo@test.com');
  assert.equal(fetchCalls[0].headers['x-webhook-secret'], 'test-secret');

  global.fetch = originalFetch;
  delete process.env.ADMIN_PORTAL_URL;
  delete process.env.WEBHOOK_SECRET;
  clearMocks();
});

test('forwards all mentorship fields to the admin webhook', async () => {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({}) };
  };

  process.env.ADMIN_PORTAL_URL = 'https://admin.test';
  process.env.WEBHOOK_SECRET = 'secret';

  const handler = freshMentorshipModule();
  const res = makeRes();
  await handler(makeReq(VALID_BODY), res);

  const payload = fetchCalls[0];
  assert.equal(payload.dobYear, '1990');
  assert.equal(payload.birthPlace, 'London, UK');
  assert.equal(payload.currentReality, 'building a soulful business');
  assert.equal(payload.dharmicVision, 'teach, heal, create');
  assert.equal(payload.practiceYN, 'yes');
  assert.equal(payload.practiceDetails, 'daily Vedic meditation');
  assert.equal(payload.readiness, 'fully ready');

  global.fetch = originalFetch;
  delete process.env.ADMIN_PORTAL_URL;
  delete process.env.WEBHOOK_SECRET;
  clearMocks();
});

test('admin webhook is non-fatal: returns 200 even if fetch throws', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Timeout'); };

  process.env.ADMIN_PORTAL_URL = 'https://admin.test';

  const handler = freshMentorshipModule();
  const res = makeRes();
  await assert.doesNotReject(handler(makeReq(VALID_BODY), res));
  assert.equal(res.statusCode, 200, 'form submission should succeed even when admin sync fails');

  global.fetch = originalFetch;
  delete process.env.ADMIN_PORTAL_URL;
  clearMocks();
});

test('admin webhook is not called when ADMIN_PORTAL_URL is not set', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => { fetchCalls.push(url); return { ok: true, json: async () => ({}) }; };

  const handler = freshMentorshipModule();
  const res = makeRes();
  await handler(makeReq(VALID_BODY), res);

  assert.equal(res.statusCode, 200);
  assert.equal(fetchCalls.length, 0, 'fetch should not be called when ADMIN_PORTAL_URL is absent');

  global.fetch = originalFetch;
  clearMocks();
});

// ── Existing behaviour regression ──────────────────────────────────────────────

test('returns 400 when email is missing', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  const handler = freshMentorshipModule();
  const res = makeRes();
  await handler(makeReq({ name: 'Halo' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Email is required');
  clearMocks();
});

test('returns 200 on a valid mentorship application', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  const handler = freshMentorshipModule();
  const res = makeRes();
  await handler(makeReq(VALID_BODY), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  clearMocks();
});

test('rejects non-POST methods with 405', async () => {
  delete process.env.ADMIN_PORTAL_URL;
  const handler = freshMentorshipModule();
  const res = makeRes();
  await handler({ method: 'GET', body: {} }, res);
  assert.equal(res.statusCode, 405);
  clearMocks();
});
