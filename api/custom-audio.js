// api/custom-audio.js
// POST /api/custom-audio
// Receives the custom hypnosis audio brief, forwards to Google Forms,
// sends the client a confirmation email, and notifies Isis internally.

const https = require('https');
const { notifyCustomAudioReceived } = require('../lib/email');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const GOOGLE_FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSf7gB_YOUR_FORM_ID/formResponse';
const ENTRY = {
  name:   'entry.797067088',
  email:  'entry.119033658',
  goal:   'entry.1043360815',
  feel:   'entry.1495537298',
  vision: 'entry.1192040380',
};

const FROM     = `Isis Anchalee <${process.env.FROM_EMAIL || 'hello@isisanchalee.com'}>`;
const REPLY_TO = process.env.REPLY_TO_EMAIL || 'isisanchalee@gmail.com';

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => { res.resume(); resolve(res.statusCode); });
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

  const { name, email, goal, feel, vision } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // ── 1. Forward to Google Forms ────────────────────────────────────────────
  try {
    const formData = new URLSearchParams();
    formData.append(ENTRY.name,   name   || '');
    formData.append(ENTRY.email,  email  || '');
    formData.append(ENTRY.goal,   goal   || '');
    formData.append(ENTRY.feel,   feel   || '');
    formData.append(ENTRY.vision, vision || '');
    await httpsPost(GOOGLE_FORM_ACTION, formData.toString());
  } catch (err) {
    console.error('Google Forms error:', err);
  }

  // ── 2. Send client confirmation email ────────────────────────────────────
  try {
    await resend.emails.send({
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'Your Custom Hypnosis Audio — Isis Anchalee',
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#EDEAE4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EDEAE4;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td style="background:#F9F8F2;padding:36px 44px 30px;">
      <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#B8975A;">✦ &nbsp;Isis Anchalee</p>
      <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#0E0B08;">Your brief<br>has been received.</h1>
    </td></tr>
    <tr><td style="background:#ffffff;padding:36px 44px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">Hi ${name || 'there'},</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">Thank you — your custom hypnosis audio brief has been received. I will craft your personalised audio and deliver it to your inbox within <strong>3 working days</strong>.</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">Check your spam folder if you don't see it arrive. If you have any questions in the meantime, reply to this email directly.</p>
      <div style="height:1px;background:#F0EBE3;margin:28px 0;"></div>
      <p style="margin:0 0 5px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">Your goal</p>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.75;color:#4a4540;padding-left:14px;border-left:2px solid #E0D5C5;font-family:Georgia,serif;">${goal || '—'}</p>
      <div style="height:1px;background:#F0EBE3;margin:28px 0;"></div>
      <p style="margin:0;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">With love,<br><em style="color:#B8975A;">Isis</em></p>
    </td></tr>
    <tr><td style="background:#F9F8F2;padding:24px 44px 32px;border-top:1px solid rgba(184,151,90,0.18);">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;">Isis Anchalee</p>
      <p style="margin:0;font-size:12px;color:rgba(14,11,8,0.4);line-height:1.7;">Hypnotherapist &amp; Spiritual Guide<br>
        <a href="${process.env.SITE_URL || 'https://isisanchalee.com'}" style="color:#B8975A;text-decoration:none;">isisanchalee.com</a>
      </p>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>`,
    });
  } catch (err) {
    console.error('Client email error:', err);
  }

  // ── 3. Send internal notification to Isis ────────────────────────────────
  try {
    await notifyCustomAudioReceived({ name, email, goal, feel, vision });
  } catch (err) {
    console.error('Internal notification error:', err);
  }

  return res.status(200).json({ success: true });
};
