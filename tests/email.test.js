// tests/email.test.js
// Tests for lib/email.js — every exported function must exist and run
// without throwing when called with realistic arguments. This is the
// exact class of bug that caused silent notification failures in
// production: functions imported elsewhere that didn't exist here, or
// template literals with unescaped quotes that crashed the whole module
// on load.

const test = require('node:test');
const assert = require('node:assert/strict');
const { setMocks, clearMocks } = require('./mock-require');

// ── Fake Resend ──────────────────────────────────────────────────────────
// Records every call so tests can assert on subject lines, recipients, etc.
let sentEmails = [];

class FakeResend {
  constructor() {
    this.emails = {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'fake_email_' + sentEmails.length }, error: null };
      },
    };
  }
}

function freshEmailModule() {
  // Clear Node's require cache for email.js so each test gets a clean
  // instance with the mock applied — otherwise the real `resend` module
  // could get cached from a previous, unmocked require.
  delete require.cache[require.resolve('../lib/email.js')];
  sentEmails = [];
  setMocks({ resend: { Resend: FakeResend } });
  const emailModule = require('../lib/email.js');
  return emailModule;
}

test('email.js loads without throwing (catches syntax errors in template strings)', () => {
  assert.doesNotThrow(() => freshEmailModule());
});

test('email.js exports every function the rest of the codebase depends on', () => {
  const email = freshEmailModule();
  const requiredExports = [
    'sendPaymentConfirmation',
    'sendSessionConfirmation',
    'sendAudioConfirmation',
    'notifyIntakeReceived',
    'notifyCustomAudioReceived',
    'notifyCustomAudioPaymentReceived',
    'notifyAudioPurchaseReceived',
    'notifyRTTSessionBooked',
  ];
  for (const fnName of requiredExports) {
    assert.equal(typeof email[fnName], 'function', `${fnName} should be exported as a function`);
  }
  clearMocks();
});

test('sendPaymentConfirmation sends an email without throwing', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.sendPaymentConfirmation('client@example.com', { name: 'Halo', sessionId: 'sess_123' })
  );
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'client@example.com');
  assert.match(sentEmails[0].subject, /confirmed/i);
  clearMocks();
});

test('sendSessionConfirmation sends an email with intake answers', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.sendSessionConfirmation('client@example.com', {
      name: 'Halo',
      focus: 'Relationship patterns',
      manifestation: 'Anxiety in dating',
      duration: '5 years',
      childhood: 'Stable household',
      outcome: 'Feel safe and open',
      previous: 'Therapy',
      medical: 'None',
      hypno: 'No',
      extra: '',
      consentSignature: 'Halo R.',
      consentDate: '2026-06-01',
    })
  );
  assert.equal(sentEmails.length, 1);
  clearMocks();
});

test('sendAudioConfirmation sends an email listing purchased files', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.sendAudioConfirmation('client@example.com', {
      productName: '3 Hypnosis Audios',
      files: [
        { name: 'Wired for Miracles.mp3', url: 'https://drive.google.com/fake1' },
        { name: 'Manifest Love.mp3', url: 'https://drive.google.com/fake2' },
      ],
    })
  );
  assert.equal(sentEmails.length, 1);
  clearMocks();
});

test('notifyIntakeReceived sends an internal notification without throwing', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyIntakeReceived({
      name: 'Halo',
      email: 'client@example.com',
      phone: '555-0100',
      focus: 'Limiting beliefs around money',
      manifestation: 'Avoidance, procrastination',
      duration: '10 years',
      childhood: 'N/A',
      outcome: 'Feel abundant',
      previous: 'None',
      medical: 'None',
      hypno: 'No',
      extra: 'Nervous but excited',
      consentSignature: 'Halo R.',
      consentDate: '2026-06-01',
    })
  );
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /intake/i);
  clearMocks();
});

test('notifyCustomAudioReceived sends an internal notification with the brief', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyCustomAudioReceived({
      name: 'Halo',
      email: 'client@example.com',
      goal: 'Confidence in dating',
      feel: 'Safe, grounded, magnetic',
      vision: 'I want to feel at ease meeting new people...',
    })
  );
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /custom audio order/i);
  clearMocks();
});

test('notifyCustomAudioPaymentReceived sends an internal notification immediately on payment', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyCustomAudioPaymentReceived({
      name: 'Halo',
      email: 'client@example.com',
      sessionId: 'cs_test_123',
      amount: 195,
      currency: 'usd',
    })
  );
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /payment received/i);
  assert.match(sentEmails[0].subject, /\$195/, 'subject should include the formatted dollar amount');
  clearMocks();
});

test('notifyCustomAudioPaymentReceived handles missing name/email gracefully', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyCustomAudioPaymentReceived({
      name: '',
      email: '',
      sessionId: 'cs_test_456',
      amount: null,
      currency: 'usd',
    })
  );
  assert.equal(sentEmails.length, 1);
  clearMocks();
});

test('notifyAudioPurchaseReceived sends an internal notification listing audios', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyAudioPurchaseReceived({
      name: 'Halo',
      email: 'client@example.com',
      audioNames: ['Wired for Miracles', 'Manifest Love'],
      productName: '2 Hypnosis Audios',
      amount: 77,
      currency: 'usd',
    })
  );
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /audio purchase/i);
  assert.match(sentEmails[0].subject, /\$77/, 'subject should include the formatted dollar amount');
  clearMocks();
});

test('notifyAudioPurchaseReceived handles an empty audioNames array gracefully', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyAudioPurchaseReceived({
      name: 'Halo',
      email: 'client@example.com',
      audioNames: [],
      productName: 'Unknown',
    })
  );
  clearMocks();
});

test('notifyAudioPurchaseReceived uses purchaseLabel in subject when provided — catches parameter shadowing bug', async () => {
  // This test exists because a parameter named "label" shadowed the label()
  // HTML helper function inside notifyAudioPurchaseReceived, causing
  // "TypeError: label is not a function" in production when webhook.js
  // passed a custom label. This test would have caught that immediately.
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyAudioPurchaseReceived({
      name: 'Halo',
      email: 'client@example.com',
      audioNames: ['How to Master the Game of Instagram'],
      productName: 'How to Master the Game of Instagram',
      amount: 37,
      currency: 'usd',
      purchaseLabel: 'Guide Purchase',
    })
  );
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /Guide Purchase/i, 'subject should use the custom purchaseLabel');
  assert.match(sentEmails[0].subject, /\$37/);
  clearMocks();
});

test('notifyAudioPurchaseReceived defaults to "Audio Purchase" when no purchaseLabel is provided', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyAudioPurchaseReceived({
      name: 'Halo',
      email: 'client@example.com',
      audioNames: ['Wired for Miracles'],
      productName: 'Wired for Miracles',
      amount: 33,
      currency: 'usd',
      // no purchaseLabel — should default
    })
  );
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /audio purchase/i);
  clearMocks();
});

test('notifyRTTSessionBooked sends an internal notification with the dollar amount in the subject', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyRTTSessionBooked({
      name: 'Halo',
      email: 'client@example.com',
      sessionId: 'cs_test_rtt_session',
      amount: 500,
      currency: 'usd',
      productName: 'Single RTT™ Session — Standard',
    })
  );
  assert.equal(sentEmails.length, 1);
  assert.match(sentEmails[0].subject, /session booked/i);
  assert.match(sentEmails[0].subject, /\$500/, 'subject should include the formatted dollar amount');
  clearMocks();
});

test('notifyRTTSessionBooked handles missing amount gracefully', async () => {
  const email = freshEmailModule();
  await assert.doesNotReject(
    email.notifyRTTSessionBooked({
      name: 'Halo',
      email: 'client@example.com',
      sessionId: 'cs_test_rtt_no_amount',
      amount: null,
      currency: 'usd',
      productName: 'RTT™ Pack of 3 — Abundant',
    })
  );
  assert.equal(sentEmails.length, 1);
  clearMocks();
});
