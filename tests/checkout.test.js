// tests/checkout.test.js

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  }));
});

// Controlled fixture — checkout.js's correctness doesn't depend on what your
// real Stripe price IDs happen to be, only on whether it correctly looks up
// PRODUCTS[productId].stripePriceId and uses it. Mocking this here means
// these tests stay valid regardless of what's actually in your real
// lib/products.js, and regardless of when you rotate/change a price ID.
jest.mock('../lib/products', () => ({
  PRODUCTS: {
    rtt_single_supported: { stripePriceId: 'price_rtt_single_supported' },
    rtt_single_standard: { stripePriceId: 'price_rtt_single_standard' },
    rtt_single_abundant: { stripePriceId: 'price_rtt_single_abundant' },
    rtt_pack_3_supported: { stripePriceId: 'price_rtt_pack_3_supported' },
    rtt_pack_3_standard: { stripePriceId: 'price_rtt_pack_3_standard' },
    rtt_pack_3_abundant: { stripePriceId: 'price_rtt_pack_3_abundant' },
    custom_audio: { stripePriceId: 'price_custom_audio' },

    instagram_guide: { stripePriceId: 'price_1TkiJmC38S5O6HWPNZHuHzJC' },
    instagram_guide_bundle: { stripePriceId: 'price_1TkiK7C38S5O6HWPG2fLMCD6' },
    instagram_guide_audit: { stripePriceId: 'price_1TkiLEC38S5O6HWPPrN7NNwO' },
    instagram_guide_audio_audit: { stripePriceId: 'price_1TkiLbC38S5O6HWP9xSxNM7X' },
    magnetic_growth_audio: { stripePriceId: 'price_1TkiLzC38S5O6HWPouVNCLAh' },
    instagram_audit_session: { stripePriceId: 'price_1TkiMLC38S5O6HWPzjaUjeId' },

    bundle_10: { stripePriceId: 'price_bundle_10', isBundle: true },
    bundle_5: { stripePriceId: 'price_bundle_5', isBundle: true },
    bundle_3: { stripePriceId: 'price_bundle_3', isBundle: true },

    wired_for_miracles: { id: 'wired_for_miracles', name: 'Wired for Miracles', stripePriceId: 'price_wired_for_miracles' },
    prosperity_consciousness: { id: 'prosperity_consciousness', name: 'Prosperity Consciousness', stripePriceId: 'price_prosperity_consciousness' },
    nervous_system_regulation: { id: 'nervous_system_regulation', name: 'Nervous System Regulation', stripePriceId: 'price_nervous_system_regulation' },
    manifest_love: { id: 'manifest_love', name: 'Manifest Love', stripePriceId: 'price_manifest_love' },
    unwavering_self_confidence: { id: 'unwavering_self_confidence', name: 'Unwavering Self-Confidence', stripePriceId: 'price_unwavering_self_confidence' },
    living_your_dream_life: { id: 'living_your_dream_life', name: 'Living Your Dream Life', stripePriceId: 'price_living_your_dream_life' },
  },
}));

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.SITE_URL = 'https://isisanchalee.com';

const Stripe = require('stripe');
const handler = require('../api/checkout');

// Grab the single mocked stripe instance created when checkout.js was required,
// so we can control / inspect checkout.sessions.create across tests.
const stripeInstance = Stripe.mock.results[0].value;
const createSession = stripeInstance.checkout.sessions.create;

function mockRes() {
  const res = {};
  res.setHeader = jest.fn(() => res);
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

function mockReq(body = {}, method = 'POST') {
  return { method, body };
}

beforeEach(() => {
  createSession.mockReset();
});

// ── BASIC HTTP HANDLING ───────────────────────────────────────────────────

describe('HTTP method handling', () => {
  test('OPTIONS request returns 200 and sets CORS headers', async () => {
    const req = mockReq({}, 'OPTIONS');
    const res = mockRes();
    await handler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.any(String));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.end).toHaveBeenCalled();
  });

  test('non-POST, non-OPTIONS request returns 405', async () => {
    const req = mockReq({}, 'GET');
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  test('request with no productId and no audioNames returns 400', async () => {
    const req = mockReq({});
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No audios selected' });
  });

  test('unrecognized productId falls through to the audio path and returns 400', async () => {
    const req = mockReq({ productId: 'totally_made_up_id' });
    const res = mockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No audios selected' });
  });
});

// ── REGRESSION: RTT / CUSTOM AUDIO SESSION CHECKOUT (pre-existing logic) ───

describe('RTT / custom audio session checkout (regression)', () => {
  test('rtt_single_standard creates a session with the right price, success_url, and metadata', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session_abc' });
    const req = mockReq({ productId: 'rtt_single_standard' });
    const res = mockRes();
    await handler(req, res);

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      line_items: [{ price: 'price_rtt_single_standard', quantity: 1 }],
      success_url: `${process.env.SITE_URL}/session-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/shop.html`,
      metadata: { productId: 'rtt_single_standard' },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.stripe.com/session_abc' });
  });

  test('custom_audio uses the custom-audio.html success_url', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/session_custom' });
    const req = mockReq({ productId: 'custom_audio' });
    const res = mockRes();
    await handler(req, res);

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      success_url: `${process.env.SITE_URL}/custom-audio.html?paid=1`,
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('Stripe failure during RTT checkout returns 500', async () => {
    createSession.mockRejectedValueOnce(new Error('stripe down'));
    const req = mockReq({ productId: 'rtt_pack_3_abundant' });
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
  });
});

// ── NEW: INSTAGRAM GUIDE / AUDIO / AUDIT CHECKOUT ──────────────────────────

describe('Instagram guide / audio / audit checkout', () => {
  const nonAuditCases = [
    ['instagram_guide', 'price_1TkiJmC38S5O6HWPNZHuHzJC'],
    ['instagram_guide_bundle', 'price_1TkiK7C38S5O6HWPG2fLMCD6'],
    ['magnetic_growth_audio', 'price_1TkiLzC38S5O6HWPouVNCLAh'],
  ];

  test.each(nonAuditCases)('%s creates a session with the correct price and the non-audit success_url', async (productId, priceId) => {
    createSession.mockResolvedValueOnce({ url: `https://checkout.stripe.com/${productId}` });
    const req = mockReq({ productId });
    const res = mockRes();
    await handler(req, res);

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/socialgrowth.html?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/socialgrowth.html`,
      metadata: { productId },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ url: `https://checkout.stripe.com/${productId}` });
  });

  const auditCases = [
    ['instagram_guide_audit', 'price_1TkiLEC38S5O6HWPPrN7NNwO'],
    ['instagram_guide_audio_audit', 'price_1TkiLbC38S5O6HWP9xSxNM7X'],
    ['instagram_audit_session', 'price_1TkiMLC38S5O6HWPzjaUjeId'],
  ];

  test.each(auditCases)('%s creates a session with the correct price and the audit-success_url', async (productId, priceId) => {
    createSession.mockResolvedValueOnce({ url: `https://checkout.stripe.com/${productId}` });
    const req = mockReq({ productId });
    const res = mockRes();
    await handler(req, res);

    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/socialgrowth.html?purchase=audit-success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/socialgrowth.html`,
      metadata: { productId },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('missing PRODUCTS entry for a recognized Instagram productId returns 404', async () => {
    // Simulate a deploy where the price ID hasn't been added to lib/products.js yet,
    // by temporarily removing the entry from the shared mocked catalog rather than
    // swapping the whole module registry (which left the Stripe mock in an
    // inconsistent state for whatever test ran immediately after this one).
    const { PRODUCTS } = require('../lib/products');
    const original = PRODUCTS.instagram_guide;
    delete PRODUCTS.instagram_guide;

    const req = mockReq({ productId: 'instagram_guide' });
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Product not found' });

    PRODUCTS.instagram_guide = original; // restore for subsequent tests
  });

  test('Stripe failure during Instagram checkout returns 500', async () => {
    createSession.mockRejectedValueOnce(new Error('stripe down'));
    const req = mockReq({ productId: 'instagram_guide_audio_audit' });
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
  });
});

// ── REGRESSION: AUDIO-CART BUNDLE PRICING LOGIC (pre-existing logic) ───────

describe('Hypnosis audio cart bundle pricing (regression)', () => {
  test('1 audio charges the individual price and tags metadata with that product id', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/single' });
    const req = mockReq({ audioNames: ['Wired for Miracles'] });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.line_items).toEqual([{ price: 'price_wired_for_miracles', quantity: 1 }]);
    expect(call.metadata.productId).toBe('wired_for_miracles');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('2 audios charges each individually and tags metadata as multi_single', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/two' });
    const req = mockReq({ audioNames: ['Wired for Miracles', 'Manifest Love'] });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.line_items).toEqual([
      { price: 'price_wired_for_miracles', quantity: 1 },
      { price: 'price_manifest_love', quantity: 1 },
    ]);
    expect(call.metadata.productId).toBe('multi_single');
  });

  test('3 audios uses the bundle_3 price as a single line item', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/three' });
    const req = mockReq({ audioNames: ['Wired for Miracles', 'Manifest Love', 'Prosperity Consciousness'] });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.line_items).toEqual([{ price: 'price_bundle_3', quantity: 1 }]);
    expect(call.metadata.productId).toBe('bundle_3');
  });

  test('4 audios uses bundle_3 plus one individual extra', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/four' });
    const req = mockReq({ audioNames: ['Wired for Miracles', 'Manifest Love', 'Prosperity Consciousness', 'Nervous System Regulation'] });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.line_items).toEqual([
      { price: 'price_bundle_3', quantity: 1 },
      { price: 'price_wired_for_miracles', quantity: 1 },
    ]);
    expect(call.metadata.productId).toBe('bundle_3_plus_1');
  });

  test('5 audios uses the bundle_5 price as a single line item', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/five' });
    const req = mockReq({
      audioNames: [
        'Wired for Miracles', 'Manifest Love', 'Prosperity Consciousness',
        'Nervous System Regulation', 'Unwavering Self-Confidence',
      ],
    });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.line_items).toEqual([{ price: 'price_bundle_5', quantity: 1 }]);
    expect(call.metadata.productId).toBe('bundle_5');
  });

  test('7 audios uses bundle_5 plus two individual extras', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/seven' });
    const req = mockReq({
      audioNames: [
        'Wired for Miracles', 'Manifest Love', 'Prosperity Consciousness',
        'Nervous System Regulation', 'Unwavering Self-Confidence',
        'Living Your Dream Life', 'Wired for Miracles',
      ],
    });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.line_items).toEqual([
      { price: 'price_bundle_5', quantity: 1 },
      { price: 'price_living_your_dream_life', quantity: 1 },
      { price: 'price_wired_for_miracles', quantity: 1 },
    ]);
    expect(call.metadata.productId).toBe('bundle_5_plus_extras');
  });

  test('10 audios uses the bundle_10 price as a single line item', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/ten' });
    const tenAudios = Array(10).fill('Wired for Miracles');
    const req = mockReq({ audioNames: tenAudios });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.line_items).toEqual([{ price: 'price_bundle_10', quantity: 1 }]);
    expect(call.metadata.productId).toBe('bundle_10');
  });

  test('an unrecognized audio name causes a 500 instead of crashing silently', async () => {
    const req = mockReq({ audioNames: ['Not A Real Audio'] });
    const res = mockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
    expect(createSession).not.toHaveBeenCalled();
  });

  test('audio checkout success_url and cancel_url point at the shop, separate from the Instagram page', async () => {
    createSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/shop-flow' });
    const req = mockReq({ audioNames: ['Wired for Miracles'] });
    const res = mockRes();
    await handler(req, res);

    const call = createSession.mock.calls[0][0];
    expect(call.success_url).toBe(`${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    expect(call.cancel_url).toBe(`${process.env.SITE_URL}/shop.html`);
  });
});
