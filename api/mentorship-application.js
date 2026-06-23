// api/mentorship-application.js
// POST /api/mentorship-application
// Receives the mentorship application form, forwards to Google Forms,
// and sends the applicant a thank-you email with a copy of their responses.

const https = require('https');
const { sendMentorshipApplicationConfirmation, notifyMentorshipApplicationReceived } = require('../lib/email');

// ── Replace with your actual Google Form entry IDs ────────────────────────────
// Open your Google Form → ⋮ → Get pre-filled link → inspect entry IDs
const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSfAeiChFW0UQD50aj9p5PnhZVhSTOU_DvzLFQwQcVVxSottGg/formResponse';
const ENTRY = {
  name:           'entry.1603839335',
  email:          'entry.1464286298',
  dobYear:        'entry.972745171_year',
  dobMonth:       'entry.972745171_month',
  dobDay:         'entry.972745171_day',
  birthTime:      'entry.707093164',
  birthPlace:     'entry.2005852651',
  currentReality: 'entry.1223968588',
  dharmicVision:  'entry.1693068142',
  innerWork:      'entry.1167018557',
  hopes:          'entry.1721812146',
  practiceYN:     'entry.1098829276',
  practiceDetails:'entry.449233744',
  readiness:      'entry.1713707066',
  investment:     'entry.1299244343',
};
// ─────────────────────────────────────────────────────────────────────────────

// Node-native HTTPS POST — no fetch dependency required
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
      res.resume(); // drain — Google Forms returns a 302, we don't need the body
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, email,
    dobYear, dobMonth, dobDay,
    birthTime, birthPlace,
    currentReality, dharmicVision, innerWork, hopes,
    practiceYN, practiceDetails,
    readiness, investment,
  } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  console.log('mentorship submission:', JSON.stringify({ name, email, dobYear, dobMonth, dobDay, birthPlace, readiness, investment }));

  // ── 1. Forward to Google Forms ────────────────────────────────────────────
  try {
    const formData = new URLSearchParams();
    formData.append(ENTRY.name,            name            || '');
    formData.append(ENTRY.email,           email           || '');
    formData.append(ENTRY.dobYear,         dobYear         || '');
    formData.append(ENTRY.dobMonth,        dobMonth        || '');
    formData.append(ENTRY.dobDay,          dobDay          || '');
    formData.append(ENTRY.birthTime,       birthTime       || '');
    formData.append(ENTRY.birthPlace,      birthPlace      || '');
    formData.append(ENTRY.currentReality,  currentReality  || '');
    formData.append(ENTRY.dharmicVision,   dharmicVision   || '');
    formData.append(ENTRY.innerWork,       innerWork       || '');
    formData.append(ENTRY.hopes,           hopes           || '');
    formData.append(ENTRY.practiceYN,      practiceYN      || '');
    formData.append(ENTRY.practiceDetails, practiceDetails || '');
    formData.append(ENTRY.readiness,       readiness       || '');
    formData.append(ENTRY.investment,      investment      || '');

    await httpsPost(GOOGLE_FORM_ACTION, formData.toString());
  } catch (err) {
    console.error('Google Forms forwarding error:', err);
    // Non-fatal — still send the email
  }

  // ── 2. Send thank-you + application copy email ────────────────────────────
  try {
    await sendMentorshipApplicationConfirmation(email, {
      name, dobYear, dobMonth, dobDay,
      birthTime, birthPlace,
      currentReality, dharmicVision, innerWork, hopes,
      practiceYN, practiceDetails,
      readiness, investment,
    });
  } catch (err) {
    console.error('Email send error:', err);
  }

  // ── 3. Send internal notification to Isis ────────────────────────────────
  try {
    await notifyMentorshipApplicationReceived({
      name, email, dobYear, dobMonth, dobDay,
      birthTime, birthPlace,
      currentReality, dharmicVision, innerWork, hopes,
      practiceYN, practiceDetails,
      readiness, investment,
    });
  } catch (err) {
    console.error('Internal notification error:', err);
  }

  // ── 4. Sync client record to admin portal ────────────────────────────────
  if (process.env.ADMIN_PORTAL_URL) {
    try {
      await fetch(`${process.env.ADMIN_PORTAL_URL}/api/client-intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.WEBHOOK_SECRET || '',
        },
        body: JSON.stringify({
          formType: 'mentorship',
          name, email,
          dobYear, dobMonth, dobDay,
          birthTime, birthPlace,
          currentReality, dharmicVision, innerWork, hopes,
          practiceYN, practiceDetails,
          readiness, investment,
        }),
      });
    } catch (err) {
      console.error('Admin portal sync error:', err);
      // Non-fatal
    }
  }

  return res.status(200).json({ success: true });
};
