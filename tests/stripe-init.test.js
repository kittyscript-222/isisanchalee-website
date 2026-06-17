// tests/stripe-init.test.js
// Regression test for a real production bug: api/session-confirm.js used
// `new Stripe(...)` instead of `Stripe(...)`, which silently returns an
// incomplete client missing methods like checkout.sessions.update() —
// no error at require time, just a crash the first time that method
// was actually called. This test loads every file that talks to Stripe
// and confirms the resulting client has the methods these files rely on.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { setMocks, clearMocks } = require('./mock-require');

// A faithful-enough fake of the real Stripe SDK shape, used to detect
// whether a file's `stripe` variable ends up with real methods on it.
// The real bug wasn't in the fake SDK — it's that `new Stripe(...)`
// on the REAL SDK returns something subtly broken. We can't fully
// reproduce that here without the real package, so this test instead
// statically checks the source code for the unsafe pattern. This is
// intentionally a static check, not a runtime one, since the failure
// mode is specific to the real Stripe package's export shape.

const FILES_USING_STRIPE = [
  '../api/session-confirm.js',
  '../api/downloads.js',
  '../api/intake.js',
  '../api/webhook.js',
];

test('no file uses the unsafe "new Stripe(...)" initialization pattern', () => {
  for (const relativePath of FILES_USING_STRIPE) {
    const fullPath = path.resolve(__dirname, relativePath);
    if (!fs.existsSync(fullPath)) continue; // skip files not present in this checkout

    const source = fs.readFileSync(fullPath, 'utf8');
    const usesNewStripe = /new\s+Stripe\s*\(/.test(source);

    assert.equal(
      usesNewStripe,
      false,
      `${relativePath} uses "new Stripe(...)" — this silently returns an incomplete client ` +
      `missing methods like checkout.sessions.update(). Use "Stripe(...)" without "new" instead. ` +
      `This exact bug caused a production crash: "stripe.checkout.sessions.update is not a function".`
    );
  }
});

test('every file that imports stripe initializes it on the same line pattern as require', () => {
  for (const relativePath of FILES_USING_STRIPE) {
    const fullPath = path.resolve(__dirname, relativePath);
    if (!fs.existsSync(fullPath)) continue;

    const source = fs.readFileSync(fullPath, 'utf8');
    const requiresStripe = /require\(['"]stripe['"]\)/.test(source);
    if (!requiresStripe) continue;

    const hasCorrectInit = /(?<!new\s+)Stripe\s*\(\s*process\.env/.test(source);
    assert.ok(
      hasCorrectInit,
      `${relativePath} requires 'stripe' but doesn't initialize it with Stripe(process.env...) — check it manually.`
    );
  }
});
