// api/intake.js
// POST /api/intake
// Receives the RTT intake form, forwards responses to Google Forms,
// and emails the client a payment confirmation + their intake copy.

const Stripe = require('stripe');
const https = require('https');
const { sendSessionConfirmation, notifyIntakeReceived } = require('../lib/email');
const { logConsentRecord } = require('../lib/sheets');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Node-native HTTP POST — works on all Node versions without fetch
function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      res.resume(); // drain response — we don't need it
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Replace these with your actual Google Form entry IDs ──────────────────────
// Use the pre-fill URL tool in Google Forms to find each entry.XXXXXXXXX value.
const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfthox2fL5VFUvEiaxp7VaSM26CyVSG6o8kAV0P6eTNtMjI1Q/formResponse';
const ENTRY = {
  name:          'entry.1333979010',
  email:         'entry.349973720',
  phone:         'entry.1552772235',
  focus:         'entry.71421018',
  manifestation: 'entry.1666321993',
  duration:      'entry.269127721',
  childhood:     'entry.1521978001',
  outcome:       'entry.1722046103',
  previous:      'entry.1874060748',
  medical:       'entry.367428364',
  extra:         'entry.162236826',
  hypno:         'entry.845857976',
};
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, name, email, phone, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra, consentSignature, consentDate } = req.body;

  console.log('intake submission:', JSON.stringify({ sessionId, name, email, phone, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra, consentSignature, consentDate }, null, 2));

  // ── 1. Resolve client email ───────────────────────────────────────────────
  // Use the email from the form if provided; fall back to the Stripe session.
  let clientEmail = email?.trim();

  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(402).json({ error: 'Payment not completed' });
      }
      // Stripe customer_details.email is the most reliable source
      if (!clientEmail && session.customer_details?.email) {
        clientEmail = session.customer_details.email;
      }
    } catch (err) {
      console.error('Stripe session retrieval error:', err);
      // Non-fatal — continue without Stripe verification
    }
  }

  // ── 2. Forward to Google Forms ────────────────────────────────────────────
  try {
    const formData = new URLSearchParams();
    formData.append(ENTRY.name,     name     || '');
    formData.append(ENTRY.email,    clientEmail || '');
    formData.append(ENTRY.phone,    phone || '');
    formData.append(ENTRY.focus,    focus    || '');
    formData.append(ENTRY.manifestation, manifestation || '');
    formData.append(ENTRY.duration, duration || '');
    formData.append(ENTRY.childhood, childhood || '');
    formData.append(ENTRY.outcome,  outcome  || '');
    formData.append(ENTRY.previous, previous || '');
    formData.append(ENTRY.medical,  medical  || '');
    formData.append(ENTRY.hypno,    hypno    || '');
    formData.append(ENTRY.extra,    extra    || '');

    await httpsPost(GOOGLE_FORM_ACTION, formData.toString());
    // Google Forms returns a 302 redirect — that's expected and means it worked
  } catch (err) {
    console.error('Google Forms forwarding error:', err);
    // Non-fatal — still send the email
  }

  // ── 3. Log consent record to Google Sheets ────────────────────────────────
  if (consentSignature) {
    try {
      await logConsentRecord({ name, email: clientEmail, phone, consentSignature, consentDate, sessionId });
    } catch (err) {
      console.error('Consent log error:', err);
      // Non-fatal — still send confirmations
    }
  }

  // ── 4. Send confirmation + intake copy email ──────────────────────────────
  if (clientEmail) {
    try {
      await sendSessionConfirmation(clientEmail, { name, phone, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra });
    } catch (err) {
      console.error('Email send error:', err);
    }
  }

  // ── 5. Send internal notification to Isis ────────────────────────────────
  try {
    await notifyIntakeReceived({ name, email: clientEmail, phone, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra, consentSignature, consentDate });
  } catch (err) {
    console.error('Internal notification error:', err);
  }

  // ── 6. Sync client record to admin portal ────────────────────────────────
  if (process.env.ADMIN_PORTAL_URL) {
    try {
      await fetch(`${process.env.ADMIN_PORTAL_URL}/api/client-intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.WEBHOOK_SECRET || '',
        },
        body: JSON.stringify({
          formType: 'rtt_intake',
          name, email: clientEmail, phone,
          focus, manifestation, duration, childhood,
          outcome, previous, medical, hypno, extra,
        }),
      });
    } catch (err) {
      console.error('Admin portal sync error:', err);
      // Non-fatal — form was already processed successfully
    }
  }

  return res.status(200).json({ success: true });
};
