# Backend Tests — Isis Anchalee Website

Automated tests for the email notification and Stripe webhook logic — the
exact code that was silently failing before (missing function exports,
a syntax error that crashed the whole `email.js` file). These tests run
without making any real API calls to Stripe or Resend, so they're free,
fast, and safe to run as often as you like.

## File placement

Add a `tests/` folder to your project root alongside `api/` and `lib/`:

```
your-project/
├── api/
│   ├── webhook.js
│   ├── downloads.js
│   └── ...
├── lib/
│   ├── email.js
│   ├── products.js
│   └── ...
└── tests/              ← add this folder
    ├── mock-require.js
    ├── email.test.js
    ├── webhook.test.js
    └── products.test.js
```

## Running the tests

No installation needed — this uses Node's built-in test runner (Node 18+).
From your project root:

```bash
node --test "tests/*.test.js"
```

Or to run a single file while debugging:

```bash
node --test tests/email.test.js
```

**Optional — add an `npm test` shortcut.** In your `package.json`, add:

```json
"scripts": {
  "test": "node --test \"tests/*.test.js\""
}
```

Then you can just run `npm test` instead of the longer command.

You'll see output like:

```
# tests 26
# pass 26
# fail 0
```

If anything shows up under `# fail`, scroll up — it'll show you exactly
which function broke and why, before you ever have to manually test a
real purchase.

## What's actually tested

**`email.test.js`** — every function in `lib/email.js` that other files
depend on (`sendPaymentConfirmation`, `notifyCustomAudioReceived`,
`notifyAudioPurchaseReceived`, etc.) is checked to confirm it: (1) actually
exists and is exported, (2) runs without throwing when called with
realistic data, and (3) the file as a whole loads without a syntax error.
This is exactly the class of bug that caused the original problem —
`downloads.js` and `custom-audio.js` were calling functions that didn't
exist, and a stray unescaped apostrophe was breaking the entire file.

**`webhook.test.js`** — the Stripe webhook handler in `api/webhook.js`.
Confirms invalid Stripe signatures are rejected (this matters — without
signature verification, anyone could fake a "payment succeeded" event),
confirms a custom audio purchase fires the immediate payment notification,
confirms regular audio purchases fire their notification exactly once
(not on every retry), and confirms the handler never crashes on unknown
products or notification failures — it should always return 200 to Stripe
so a temporary email outage doesn't trigger endless retries.

**`products.test.js`** — sanity-checks the product catalog in
`lib/products.js`: every product has a valid-looking Stripe Price ID, no
two products accidentally share the same Price ID (which would route a
sale to the wrong product), and every catalog key matches its own `id`
field.

## When to run this

Run `node --test tests/` any time you or I change `email.js`,
`webhook.js`, `products.js`, `downloads.js`, or `custom-audio.js` —
ideally before deploying. It takes under half a second.

## Adding new tests later

If a new product or notification function gets added, the natural next
step is adding a matching test in the relevant `.test.js` file, following
the existing pattern: mock `resend`/`stripe` via `setMocks()`, call the
real function, and assert it didn't throw and produced something sensible
(a subject line, a recipient, a status code).
