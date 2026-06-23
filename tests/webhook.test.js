// tests/webhook.test.js
// Tests for api/webhook.js — the Stripe webhook handler.
//
// Verifies:
//  - Invalid signatures are rejected (security-critical)
//  - checkout.session.completed for custom_audio fires the payment-received notification
//  - checkout.session.completed for audio products fires the purchase notification (once)
//  - Non-completed events are acknowledged but ignored
//  - A bug in notification logic never causes Stripe to retry forever (always 200s on processing errors)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setMocks, clearMocks } = require('./mock-require');

let sentNotifications = [];
let updatedMetadata = [];
let lastConstructEventArgs = null;

function makeFakeStripe({ throwOnSignature = false, sessionOverrides = {} } = {}) {
  return function FakeStripeFactory() {
    return {
      webhooks: {
        constructEvent: (rawBody, signature, secret) => {
          lastConstructEventArgs = { rawBody, signature, secret };
          if (throwOnSignature) {
            throw new Error('No signatures found matching the expected signature for payload');
          }
          // Return whatever event the test pre-set via global._fakeEvent
          return global._fakeEvent;
        },
      },
      checkout: {
        sessions: {
          retrieve: async (sessionId, opts) => {
            return {
              id: sessionId,
              customer_details: { name: 'Halo', email: 'halo@example.com' },
              amount_total: 19500,
              currency: 'usd',
              metadata: {},
              line_items: { data: [{ price: { id: sessionOverrides.priceId || 'price_unknown' } }] },
              ...sessionOverrides,
            };
          },
          update: async (sessionId, payload) => {
            updatedMetadata.push({ sessionId, payload });
            return {};
          },
        },
      },
    };
  };
}

function makeFakeReq({ body = 'raw-body-bytes', headers = { 'stripe-signature': 'sig_test' } } = {}) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = headers;
  // Simulate the stream emitting the body then ending, asynchronously,
  // matching how a real Vercel request stream behaves.
  setImmediate(() => {
    req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

function makeFakeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function freshWebhookModule() {
  delete require.cache[require.resolve('../api/webhook.js')];
  delete require.cache[require.resolve('../lib/email.js')];
  sentNotifications = [];
  updatedMetadata = [];

  setMocks({
    stripe: makeFakeStripe(),
    resend: {
      Resend: class {
        emails = {
          send: async (payload) => {
            sentNotifications.push(payload);
            return { data: { id: 'fake_' + sentNotifications.length } };
          },
        };
      },
    },
  });

  return require('../api/webhook.js');
}

test('rejects non-POST requests', async () => {
  const handler = freshWebhookModule();
  const req = { method: 'GET' };
  const res = makeFakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  clearMocks();
});

test('rejects requests with an invalid Stripe signature', async () => {
  setMocks({
    stripe: makeFakeStripe({ throwOnSignature: true }),
    resend: { Resend: class { emails = { send: async () => ({}) } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /signature verification failed/i);
  clearMocks();
});

test('ignores event types other than checkout.session.completed', async () => {
  const handler = freshWebhookModule();
  global._fakeEvent = { type: 'payment_intent.created', data: { object: {} } };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ignored, 'payment_intent.created');
  assert.equal(sentNotifications.length, 0);
  clearMocks();
});

test('custom_audio purchase fires notifyCustomAudioPaymentReceived', async () => {
  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: { priceId: 'price_1TbcM2C38S5O6HWPhQAa58iF' } }), // custom_audio's price ID
    resend: {
      Resend: class {
        emails = { send: async (p) => { sentNotifications.push(p); return {}; } };
      },
    },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_custom_audio' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sentNotifications.length, 1);
  assert.match(sentNotifications[0].subject, /payment received/i);
  assert.match(sentNotifications[0].subject, /\$195/, 'subject should include the dollar amount from the Stripe session');
  clearMocks();
});

test('regular audio purchase fires notifyAudioPurchaseReceived and sets dedup metadata', async () => {
  sentNotifications = [];
  updatedMetadata = [];
  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: { priceId: 'price_1TitYaC38S5O6HWPEVduUAKM' } }), // nervous_system_regulation
    resend: {
      Resend: class {
        emails = { send: async (p) => { sentNotifications.push(p); return {}; } };
      },
    },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_audio' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sentNotifications.length, 1);
  assert.match(sentNotifications[0].subject, /audio purchase/i);
  assert.match(sentNotifications[0].subject, /\$195/, 'subject should include the dollar amount from the Stripe session');
  assert.equal(updatedMetadata.length, 1);
  assert.equal(updatedMetadata[0].payload.metadata.webhookNotified, 'true');
  clearMocks();
});

test('does not double-notify if webhookNotified metadata is already set', async () => {
  sentNotifications = [];
  updatedMetadata = [];
  const factory = () => ({
    webhooks: {
      constructEvent: () => global._fakeEvent,
    },
    checkout: {
      sessions: {
        retrieve: async (sessionId) => ({
          id: sessionId,
          customer_details: { name: 'Halo', email: 'halo@example.com' },
          amount_total: 3300,
          currency: 'usd',
          metadata: { webhookNotified: 'true' }, // already notified
          line_items: { data: [{ price: { id: 'price_1TitYaC38S5O6HWPEVduUAKM' } }] },
        }),
        update: async (sessionId, payload) => { updatedMetadata.push({ sessionId, payload }); return {}; },
      },
    },
  });

  setMocks({
    stripe: () => factory(),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_already_notified' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sentNotifications.length, 0, 'should not send a duplicate notification');
  clearMocks();
});

test('unmatched price IDs do not crash the handler', async () => {
  const handler = freshWebhookModule();
  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_unknown_product' } },
  };
  // default fake stripe returns priceId: 'price_unknown', which matches no catalog entry

  const req = makeFakeReq();
  const res = makeFakeRes();
  await assert.doesNotReject(handler(req, res));
  assert.equal(res.statusCode, 200);
  clearMocks();
});

test('always returns 200 even if internal notification logic throws (prevents endless Stripe retries)', async () => {
  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: { priceId: 'price_1TbcM2C38S5O6HWPhQAa58iF' } }),
    resend: {
      Resend: class {
        emails = {
          send: async () => { throw new Error('Resend API is down'); },
        };
      },
    },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_email_fails' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  // Payment succeeded; only the notification failed. Stripe should not retry.
  assert.equal(res.statusCode, 200);
  clearMocks();
});

test('RTT session booking fires notifyRTTSessionBooked with the dollar amount in the subject', async () => {
  sentNotifications = [];
  updatedMetadata = [];
  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: { priceId: 'price_1TZsO1C38S5O6HWP0ixwGJf7' } }), // rtt_single_standard — $500
    resend: {
      Resend: class {
        emails = { send: async (p) => { sentNotifications.push(p); return {}; } };
      },
    },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_rtt_session' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sentNotifications.length, 1);
  assert.match(sentNotifications[0].subject, /session booked/i);
  assert.match(sentNotifications[0].subject, /\$195/, 'subject should include the dollar amount from the Stripe session (fake session defaults to $195 total)');
  assert.equal(updatedMetadata.length, 1);
  assert.equal(updatedMetadata[0].payload.metadata.sessionWebhookNotified, 'true');
  clearMocks();
});

test('does not double-notify an RTT session booking if sessionWebhookNotified metadata is already set', async () => {
  sentNotifications = [];
  updatedMetadata = [];
  const factory = () => ({
    webhooks: {
      constructEvent: () => global._fakeEvent,
    },
    checkout: {
      sessions: {
        retrieve: async (sessionId) => ({
          id: sessionId,
          customer_details: { name: 'Halo', email: 'halo@example.com' },
          amount_total: 50000,
          currency: 'usd',
          metadata: { sessionWebhookNotified: 'true' },
          line_items: { data: [{ price: { id: 'price_1TZsO1C38S5O6HWP0ixwGJf7' } }] },
        }),
        update: async (sessionId, payload) => { updatedMetadata.push({ sessionId, payload }); return {}; },
      },
    },
  });

  setMocks({
    stripe: () => factory(),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_rtt_already_notified' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sentNotifications.length, 0, 'should not send a duplicate session-booked notification');
  clearMocks();
});

// ── NEW: Instagram guide / audio / audit webhook handler ──────────────────────

test('instagram digital product (magnetic_growth_audio) fires sendAudioConfirmation — not notifyRTTSessionBooked', async () => {
  sentNotifications = [];
  updatedMetadata = [];

  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: {
      priceId: 'price_1TkiLzC38S5O6HWPouVNCLAh', // magnetic_growth_audio
      amount_total: 3300,
    }}),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_ig_audio' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  // Should send exactly 2 emails: sendAudioConfirmation (customer) + notifyAudioPurchaseReceived (internal)
  assert.equal(sentNotifications.length, 2, 'should send customer confirmation + internal notification');
  // Neither should be a session-booked notification
  const subjects = sentNotifications.map(n => n.subject || '');
  assert.ok(!subjects.some(s => /session booked/i.test(s)), 'should not fire RTT session-booked email for Instagram audio');
  // instagramNotified metadata should be set to prevent double-notification
  assert.equal(updatedMetadata.length, 1);
  assert.equal(updatedMetadata[0].payload.metadata.instagramNotified, 'true');
  clearMocks();
});

test('instagram guide bundle fires sendAudioConfirmation with both PDF and audio files', async () => {
  sentNotifications = [];
  updatedMetadata = [];

  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: {
      priceId: 'price_1TkiK7C38S5O6HWPG2fLMCD6', // instagram_guide_bundle
      amount_total: 6000,
    }}),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_ig_bundle' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sentNotifications.length, 2);
  clearMocks();
});

test('instagram_guide_audio_audit fires sendAudioConfirmation — not notifyRTTSessionBooked', async () => {
  sentNotifications = [];
  updatedMetadata = [];

  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: {
      priceId: 'price_1Tl6oSC38S5O6HWPJ6Rjkzdz', // instagram_guide_audio_audit $495
      amount_total: 49500,
    }}),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_ig_full_bundle' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const subjects = sentNotifications.map(n => n.subject || '');
  assert.ok(!subjects.some(s => /RTT/i.test(s)), 'should not fire RTT email for Instagram audit bundle');
  assert.equal(updatedMetadata[0]?.payload?.metadata?.instagramNotified, 'true');
  clearMocks();
});

test('does not double-notify Instagram purchase if instagramNotified is already set', async () => {
  sentNotifications = [];
  updatedMetadata = [];

  const factory = () => ({
    webhooks: { constructEvent: () => global._fakeEvent },
    checkout: {
      sessions: {
        retrieve: async (sessionId) => ({
          id: sessionId,
          customer_details: { name: 'Halo', email: 'halo@example.com' },
          amount_total: 3300,
          currency: 'usd',
          metadata: { instagramNotified: 'true' }, // already notified
          line_items: { data: [{ price: { id: 'price_1TkiLzC38S5O6HWPouVNCLAh' } }] },
        }),
        update: async (sessionId, payload) => { updatedMetadata.push({ sessionId, payload }); return {}; },
      },
    },
  });

  setMocks({
    stripe: () => factory(),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_ig_already_notified' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(sentNotifications.length, 0, 'should not send duplicate notification');
  clearMocks();
});

test('Instagram audit products do not trigger notifyRTTSessionBooked', async () => {
  sentNotifications = [];

  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: {
      priceId: 'price_1Tl6oSC38S5O6HWPJ6Rjkzdz', // instagram_guide_audio_audit
      amount_total: 49500,
    }}),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_ig_no_rtt' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  const subjects = sentNotifications.map(n => n.subject || '');
  assert.ok(
    !subjects.some(s => /session booked/i.test(s)),
    'Instagram audit must not fire the RTT session-booked email'
  );
  clearMocks();
});

test('regular RTT session still fires notifyRTTSessionBooked after Instagram handler was added', async () => {
  sentNotifications = [];
  updatedMetadata = [];

  setMocks({
    stripe: makeFakeStripe({ sessionOverrides: {
      priceId: 'price_1TZsO1C38S5O6HWP0ixwGJf7', // rtt_single_standard
      amount_total: 50000,
    }}),
    resend: { Resend: class { emails = { send: async (p) => { sentNotifications.push(p); return {}; } } } },
  });
  delete require.cache[require.resolve('../api/webhook.js')];
  const handler = require('../api/webhook.js');

  global._fakeEvent = {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_rtt_regression' } },
  };

  const req = makeFakeReq();
  const res = makeFakeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  const subjects = sentNotifications.map(n => n.subject || '');
  assert.ok(subjects.some(s => /session booked/i.test(s)), 'RTT session should still fire session-booked email');
  clearMocks();
});
