// lib/email.js
// Shared transactional email via Resend.
// Required env vars:
//   RESEND_API_KEY   — from resend.com/api-keys
//   FROM_EMAIL       — e.g. hello@isisanchalee.com (must be a verified domain in Resend)
//   REPLY_TO_EMAIL   — e.g. isisanchalee@gmail.com
//   SITE_URL         — e.g. https://isisanchalee.com

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM     = `Isis Anchalee <${process.env.FROM_EMAIL || 'hello@isisanchalee.com'}>`;
const REPLY_TO = process.env.REPLY_TO_EMAIL || 'isisanchalee@gmail.com';
const SITE     = process.env.SITE_URL       || 'https://isisanchalee.com';
const ADMIN    = 'isisanchalee@gmail.com'; // internal notification recipient

// ─── TEMPLATE ─────────────────────────────────────────────────────────────────
// Dark header + white body + dark footer. Body text on white for readability.

function branded(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#EDEAE4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EDEAE4;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- DARK HEADER -->
      <tr>
        <td style="background:#F9F8F2;padding:36px 44px 30px;">
          <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#B8975A;">✦ &nbsp;Isis Anchalee</p>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:400;line-height:1.25;color:#0E0B08;">${title}</h1>
        </td>
      </tr>

      <!-- WHITE BODY -->
      <tr>
        <td style="background:#ffffff;padding:36px 44px;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- DARK FOOTER -->
      <tr>
        <td style="background:#F9F8F2;padding:24px 44px 32px;border-top:1px solid rgba(184,151,90,0.18);">
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;">Isis Anchalee</p>
          <p style="margin:0;font-size:12px;color:rgba(14,11,8,0.4);line-height:1.7;">
            Hypnotherapist &amp; Spiritual Guide<br>
            <a href="${SITE}" style="color:#B8975A;text-decoration:none;">isisanchalee.com</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── BODY HELPERS (dark text on white) ───────────────────────────────────────

function p(text, style = '') {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;${style}">${text}</p>`;
}

function gold(text) {
  return `<span style="color:#B8975A;">${text}</span>`;
}

function divider() {
  return `<div style="height:1px;background:#F0EBE3;margin:28px 0;"></div>`;
}

function sectionHeading(text) {
  return `<p style="margin:0 0 20px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">${text}</p>`;
}

function label(text) {
  return `<p style="margin:0 0 5px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">${text}</p>`;
}

function answer(text) {
  return `<p style="margin:0 0 22px;font-size:14px;line-height:1.75;color:#4a4540;padding-left:14px;border-left:2px solid #E0D5C5;font-family:Georgia,serif;">${text || '—'}</p>`;
}

function ctaButton(text, url) {
  return `<a href="${url}" style="display:inline-block;margin:8px 0 4px;padding:14px 30px;background:#B8975A;color:#ffffff;font-family:Georgia,serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;">${text}</a>`;
}

// ─── EMAILS ───────────────────────────────────────────────────────────────────

/**
 * sendPaymentConfirmation
 * Fired immediately when the client lands on session-success.html.
 * No intake data yet — just confirms payment and prompts them to fill the form.
 */
async function sendPaymentConfirmation(to, { name, sessionId }) {
  const intakeUrl = `${SITE}/session-success.html?session_id=${sessionId}`;
  const body = `
    ${p(`Hi ${name || 'there'},`)}
    ${p(`Your payment has been received. ${gold('You\'re booked.')} Before our session, please take a few minutes to complete your intake form — it helps me prepare fully so we can go as deep as possible together.`)}
    <div style="margin:28px 0;">
      ${ctaButton('Complete Your Intake Form →', intakeUrl)}
    </div>
    ${p('You\'ll also find your session booking link on that same page once the form is submitted.', 'margin-top:4px;')}
    ${divider()}
    ${p('If you need to reschedule or have any questions before we begin, reply to this email directly.')}
    ${p(`With love,<br><em style="color:#B8975A;">Isis</em>`)}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to,
    subject: 'Your RTT™ Session is Confirmed — Isis Anchalee',
    html: branded('Your session<br>is confirmed.', body),
  });
}

/**
 * sendSessionConfirmation
 * Fired when the client submits the intake form.
 * Sends their full intake copy for their records.
 */
async function sendSessionConfirmation(to, { name, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra }) {
  const body = `
    ${p(`Hi ${name || 'there'},`)}
    ${p(`Your intake form has been received. I\'ll review everything carefully before our session — thank you for taking the time to share so openly.`)}
    ${divider()}
    ${sectionHeading('Your Intake Form — for your records')}
    ${label('What you want to shift')}
    ${answer(focus)}
    ${label('How it shows up in your life')}
    ${answer(manifestation)}
    ${label('How long you\'ve been experiencing this')}
    ${answer(duration)}
    ${label('Childhood environment & significant early experiences')}
    ${answer(childhood)}
    ${label('Your desired outcome')}
    ${answer(outcome)}
    ${label('What you\'ve already tried')}
    ${answer(previous)}
    ${label('Medical / mental health notes')}
    ${answer(medical)}
    ${label('Experienced hypnotherapy before')}
    ${answer(hypno)}
    ${extra ? `${label('Anything else')}${answer(extra)}` : ''}
    ${divider()}
    ${p('If you need to reschedule or have any questions before we begin, reply to this email directly.')}
    ${p(`With love,<br><em style="color:#B8975A;">Isis</em>`)}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to,
    subject: 'Your Intake Form — Isis Anchalee',
    html: branded('Your intake form<br>has been received.', body),
  });
}

/**
 * sendAudioConfirmation
 * Fired once after a successful audio purchase, with download links.
 */
async function sendAudioConfirmation(to, { productName, files }) {
  const fileLinks = files.map(f =>
    `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EBE3;">
        <span style="font-size:14px;color:#3a3530;font-family:Georgia,serif;">${f.name}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EBE3;text-align:right;white-space:nowrap;">
        <a href="${f.url}" style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#B8975A;text-decoration:none;font-family:Georgia,serif;">Download →</a>
      </td>
    </tr>`
  ).join('');

  const body = `
    ${p('Your payment is confirmed. Your downloads are ready below — save them to your device so you always have access.')}
    ${divider()}
    ${sectionHeading(productName)}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D8;margin-bottom:28px;">
      ${fileLinks}
    </table>
    ${p('For best results, listen with headphones every morning upon waking AND as you fall asleep at night. The timing matters. ‼️<br><br>Repeat daily for a <em>minimum</em> of 21 days, and continue beyond that until you feel the shifts have become permanent. I listen to some for 3–6 months straight, or until I feel that a particular recording has fully integrated. This part matters: neuroplasticity requires consistent repetition to create lasting re-patterning at the subconscious level.')}
    ${p('If you have any trouble with your downloads, reply to this email and I\'ll resend them directly.')}
    ${p(`With love,<br><em style="color:#B8975A;">Isis</em>`)}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to,
    subject: `Your Downloads Are Ready — ${productName}`,
    html: branded('Your purchase<br>is confirmed.', body),
  });
}

/**
 * sendMentorshipApplicationConfirmation
 * Fired when someone submits the Dharmic Identity Shift mentorship application.
 * Thanks them for applying and sends a copy of their responses.
 */
async function sendMentorshipApplicationConfirmation(to, {
  name, dobYear, dobMonth, dobDay,
  birthTime, birthPlace,
  currentReality, dharmicVision, innerWork, hopes,
  practiceYN, practiceDetails,
  readiness, investment,
}) {
  const dob = [dobDay, dobMonth, dobYear].filter(Boolean).join(' / ') || '—';

  const body = `
    ${p(`Hi ${name || 'there'},`)}
    ${p(`Thank you so much for applying for the <em style="color:#B8975A;">Dharmic Identity Shift</em> mentorship. I have received your application and will be reviewing it with full attention. If it feels like a genuine fit, I will be in touch within a few days to schedule a conversation.`)}
    ${p(`In the meantime, know that the fact you are here — that you said yes to this level of work — already means something. ✦`)}
    ${divider()}
    ${sectionHeading('Your Application — for your records')}
    ${label('Date of birth')}
    ${answer(dob)}
    ${label('Birth time')}
    ${answer(birthTime)}
    ${label('Birth place')}
    ${answer(birthPlace)}
    ${label('Your current reality')}
    ${answer(currentReality)}
    ${label('Your dharmic vision')}
    ${answer(dharmicVision)}
    ${label('Inner work you have already done')}
    ${answer(innerWork)}
    ${label('What you are hoping to experience')}
    ${answer(hopes)}
    ${label('Active spiritual or somatic practice')}
    ${answer(practiceYN)}
    ${practiceDetails ? `${label('Practice details')}${answer(practiceDetails)}` : ''}
    ${label('Readiness')}
    ${answer(readiness)}
    ${label('Investment readiness')}
    ${answer(investment)}
    ${divider()}
    ${p(`If you have any questions in the meantime, you are welcome to reply to this email directly.`)}
    ${p(`With love,<br><em style="color:#B8975A;">Isis</em>`)}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: REPLY_TO,
    to,
    subject: 'Your Mentorship Application — Isis Anchalee',
    html: branded('Thank you<br>for applying.', body),
  });
}


/**
 * notifyIntakeReceived — internal copy of RTT intake sent to Isis
 */
async function notifyIntakeReceived({ name, email, phone, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra }) {
  const body = `
    ${p(`<strong>New RTT™ intake received</strong> from ${name || 'unknown'} (${email || '—'})`)}
    ${divider()}
    ${label('Name')}              ${answer(name)}
    ${label('Email')}             ${answer(email)}
    ${label('Phone')}             ${answer(phone)}
    ${label('What they want to shift')} ${answer(focus)}
    ${label('How it shows up')}   ${answer(manifestation)}
    ${label('Duration')}          ${answer(duration)}
    ${label('Childhood')}         ${answer(childhood)}
    ${label('Desired outcome')}   ${answer(outcome)}
    ${label('Previously tried')}  ${answer(previous)}
    ${label('Medical notes')}     ${answer(medical)}
    ${label('Hypno before')}      ${answer(hypno)}
    ${extra ? `${label('Extra')}${answer(extra)}` : ''}
  `;

  return resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `New RTT™ Intake — ${name || email}`,
    html: branded(`New RTT™ Intake`, body),
  });
}

/**
 * notifyMentorshipApplicationReceived — internal copy of mentorship application sent to Isis
 */
async function notifyMentorshipApplicationReceived({ name, email, dobYear, dobMonth, dobDay, birthTime, birthPlace, currentReality, dharmicVision, innerWork, hopes, practiceYN, practiceDetails, readiness, investment }) {
  const dob = [dobDay, dobMonth, dobYear].filter(Boolean).join(' / ') || '—';

  const body = `
    ${p(`<strong>New mentorship application</strong> from ${name || 'unknown'} (${email || '—'})`)}
    ${divider()}
    ${label('Name')}              ${answer(name)}
    ${label('Email')}             ${answer(email)}
    ${label('Date of birth')}     ${answer(dob)}
    ${label('Birth time')}        ${answer(birthTime)}
    ${label('Birth place')}       ${answer(birthPlace)}
    ${label('Current reality')}   ${answer(currentReality)}
    ${label('Dharmic vision')}    ${answer(dharmicVision)}
    ${label('Inner work done')}   ${answer(innerWork)}
    ${label('Hopes')}             ${answer(hopes)}
    ${label('Practice')}          ${answer(practiceYN)}
    ${practiceDetails ? `${label('Practice details')}${answer(practiceDetails)}` : ''}
    ${label('Readiness')}         ${answer(readiness)}
    ${label('Investment')}        ${answer(investment)}
  `;

  return resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `New Mentorship Application — ${name || email}`,
    html: branded(`New Mentorship Application`, body),
  });
}

/**
 * notifyAudioPurchaseReceived — internal notification to Isis when someone buys hypnosis audios
 */
async function notifyAudioPurchaseReceived({ name, email, audioNames = [], productName }) {
  const audioList = audioNames.map(a => `<tr><td style="padding:8px 0;font-size:14px;color:#4a4540;border-bottom:1px solid #F0EBE3;font-family:Georgia,serif;">${a}</td></tr>`).join('');

  const body = `
    ${p(`<strong>New audio purchase</strong> from ${name || 'unknown'} (${email || '—'})`)}
    ${divider()}
    ${sectionHeading(productName || 'Hypnosis Audios')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${audioList}
    </table>
    ${label('Customer email')}
    ${answer(email)}
    ${label('Customer name')}
    ${answer(name)}
  `;

  return resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `New Audio Purchase — ${name || email}`,
    html: branded('New Audio Purchase', body),
  });
}

/**
 * notifyCustomAudioReceived — internal notification to Isis for custom audio orders
 */
async function notifyCustomAudioReceived({ name, email, goal, feel, vision }) {
  const body = `
    ${p(`<strong>New custom audio brief</strong> from ${name || 'unknown'} (${email || '—'})`)}
    ${divider()}
    ${label('Name')}   ${answer(name)}
    ${label('Email')}  ${answer(email)}
    ${label('Goal')}   ${answer(goal)}
    ${label('How they want to feel')} ${answer(feel)}
    ${label('Vision / manifestation')} ${answer(vision)}
  `;

  return resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `New Custom Audio Brief — ${name || email}`,
    html: branded('New Custom Audio Brief', body),
  });
}

module.exports = { sendPaymentConfirmation, sendSessionConfirmation, sendAudioConfirmation, sendMentorshipApplicationConfirmation, notifyIntakeReceived, notifyMentorshipApplicationReceived, notifyAudioPurchaseReceived, notifyCustomAudioReceived };
