// tests/deliver.test.js
// Tests for api/deliver.js — the endpoint that verifies a Stripe payment
// and returns file download links for the post-purchase overlay.
//
// This endpoint is the bridge between a successful Stripe checkout and the
// buyer actually receiving their files on the page. If it breaks:
//   - The overlay freezes on "Preparing your files..."
//   - Buyers can't download what they paid for without the email fallback
//
// Run with: node --test tests/deliver.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { setMocks, clearMocks } = require('./mock-require');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; },
  };
  return res;
}

function mockReq({ method = 'GET', query = {} } = {}) {
  return { method, query };
}

function makeFakeStripe(sessionOverrides = {}) {
  return function FakeStripe() {
    return {
      checkout: {
        sessions: {
          retrieve: async (sessionId) => ({
            id: sessionId,
            payment_status: 'paid',
            customer_details: { name: 'Halo', email: 'halo@example.com' },
            metadata: { productId: 'magnetic_growth_audio' },
            ...sessionOverrides,
          }),
        },
      },
    };
  };
}

function freshDeliverModule(stripeOverrides = {}) {
  delete require.cache[require.resolve('../api/deliver.js')];
  delete require.cache[require.resolve('../lib/products.js')];
  setMocks({ stripe: makeFakeStripe(stripeOverrides) });
  return require('../api/deliver.js');
}

// ── HTTP method handling ──────────────────────────────────────────────────────

test('OPTIONS request returns 200', async () => {
  const handler = freshDeliverModule();
  const req = mockReq({ method: 'OPTIONS' });
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  clearMocks();
});

test('non-GET request returns 405', async () => {
  const handler = freshDeliverModule();
  const req = mockReq({ method: 'POST' });
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.error, 'Method not allowed');
  clearMocks();
});

test('missing session_id returns 400', async () => {
  const handler = freshDeliverModule();
  const req = mockReq({ query: {} });
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Missing session_id');
  clearMocks();
});

// ── Payment verification ──────────────────────────────────────────────────────

test('unpaid session returns 402', async () => {
  const handler = freshDeliverModule({ payment_status: 'unpaid' });
  const req = mockReq({ query: { session_id: 'cs_test_unpaid' } });
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.error, 'Payment not completed');
  clearMocks();
});

test('session with no productId in metadata returns 404', async () => {
  const handler = freshDeliverModule({ metadata: {} });
  const req = mockReq({ query: { session_id: 'cs_test_no_product' } });
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
  clearMocks();
});

test('session with unknown productId returns 404', async () => {
  const handler = freshDeliverModule({ metadata: { productId: 'totally_unknown_product' } });
  const req = mockReq({ query: { session_id: 'cs_test_unknown' } });
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'Product not found');
  clearMocks();
});

// ── Successful delivery ───────────────────────────────────────────────────────

test('magnetic_growth_audio returns the audio file with a correct Drive download URL', async () => {
  const handler = freshDeliverModule({
    metadata: { productId: 'magnetic_growth_audio' },
  });
  const req = mockReq({ query: { session_id: 'cs_test_audio' } });
  const res = mockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.productId, 'magnetic_growth_audio');
  assert.equal(res.body.customerEmail, 'halo@example.com');
  assert.equal(res.body.files.length, 1);
  assert.equal(res.body.files[0].name, 'Instagram Identity Shift.mp3');
  assert.ok(
    res.body.files[0].url.includes('drive.google.com'),
    'download URL should point to Google Drive'
  );
  assert.ok(
    res.body.files[0].url.includes('1JNlZhCFS42QeD5Dqtz2wl9Ot0puV-48Q'),
    'download URL should include the correct Drive file ID'
  );
  clearMocks();
});

test('instagram_guide returns the PDF file', async () => {
  const handler = freshDeliverModule({
    metadata: { productId: 'instagram_guide' },
  });
  const req = mockReq({ query: { session_id: 'cs_test_guide' } });
  const res = mockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.files.length, 1);
  assert.ok(res.body.files[0].name.endsWith('.pdf'), 'guide should deliver a PDF file');
  assert.ok(
    res.body.files[0].url.includes('1p1c6itLaYe0jrpiZ0LuuDbXhGite-dbT'),
    'PDF download URL should include the correct Drive file ID'
  );
  clearMocks();
});

test('instagram_guide_bundle returns both the PDF and the audio file', async () => {
  const handler = freshDeliverModule({
    metadata: { productId: 'instagram_guide_bundle' },
  });
  const req = mockReq({ query: { session_id: 'cs_test_bundle' } });
  const res = mockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.files.length, 2);

  const names = res.body.files.map(f => f.name);
  assert.ok(names.some(n => n.endsWith('.pdf')), 'bundle should include the PDF guide');
  assert.ok(names.some(n => n.endsWith('.mp3')), 'bundle should include the audio file');
  clearMocks();
});

test('instagram_guide_audio_audit returns both PDF and audio', async () => {
  const handler = freshDeliverModule({
    metadata: { productId: 'instagram_guide_audio_audit' },
  });
  const req = mockReq({ query: { session_id: 'cs_test_full_bundle' } });
  const res = mockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.files.length, 2);
  clearMocks();
});

test('instagram_guide_audio_audit (full bundle) returns 200 with both PDF and audio files', async () => {
  const handler = freshDeliverModule({
    metadata: { productId: 'instagram_guide_audio_audit' },
  });
  const req = mockReq({ query: { session_id: 'cs_test_full_bundle_2' } });
  const res = mockRes();
  await handler(req, res);

  // The full bundle includes both guide + audio — caller checks files.length
  // to decide what to show in the overlay
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.files.length, 2);
  const names = res.body.files.map(f => f.name);
  assert.ok(names.some(n => n.endsWith('.pdf')), 'full bundle should include PDF');
  assert.ok(names.some(n => n.endsWith('.mp3')), 'full bundle should include audio');
  clearMocks();
});

test('Stripe failure returns 500', async () => {
  delete require.cache[require.resolve('../api/deliver.js')];
  setMocks({
    stripe: function FakeStripe() {
      return {
        checkout: {
          sessions: {
            retrieve: async () => { throw new Error('Stripe is down'); },
          },
        },
      };
    },
  });
  const handler = require('../api/deliver.js');
  const req = mockReq({ query: { session_id: 'cs_test_stripe_error' } });
  const res = mockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Failed to retrieve purchase details');
  clearMocks();
});

// ── Download URL format ───────────────────────────────────────────────────────

test('all returned download URLs use the correct Google Drive export format', async () => {
  const handler = freshDeliverModule({
    metadata: { productId: 'instagram_guide_bundle' },
  });
  const req = mockReq({ query: { session_id: 'cs_test_url_format' } });
  const res = mockRes();
  await handler(req, res);

  for (const file of res.body.files) {
    assert.ok(
      file.url.startsWith('https://drive.google.com/uc?export=download&id='),
      `URL should use the direct download format: ${file.url}`
    );
    assert.ok(
      file.viewUrl.startsWith('https://drive.google.com/file/d/'),
      `viewUrl should use the file view format: ${file.viewUrl}`
    );
  }
  clearMocks();
});
