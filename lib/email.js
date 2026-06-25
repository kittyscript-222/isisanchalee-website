// lib/email.js
// Shared transactional email via Resend.
// Required env vars:
//   RESEND_API_KEY   — from resend.com/api-keys
//   FROM_EMAIL       — e.g. hello@isisanchalee.com (must be a verified domain in Resend)
//   REPLY_TO_EMAIL   — e.g. isisanchalee@gmail.com
//   SITE_URL         — e.g. https://isisanchalee.com

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM          = `Isis Anchalee <${process.env.FROM_EMAIL || 'hello@isisanchalee.com'}>`;
const REPLY_TO      = process.env.REPLY_TO_EMAIL  || 'isisanchalee@gmail.com';
const SITE          = process.env.SITE_URL        || 'https://isisanchalee.com';
const FREEBIE_URL   = process.env.FREEBIE_URL     || 'https://isisanchalee.com/#newsletter';

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
 * Includes session prep steps, nervous system audio invitation, and intake copy.
 */
async function sendSessionConfirmation(to, { name, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra, consentSignature, consentDate }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p(`Your intake form has been received. I'll review everything carefully before our session — thank you for taking the time to share so openly.`)}

    ${divider()}

    ${sectionHeading('Prepare for our session together')}
    ${p('This is your dedicated time for deep, empowering shifts and harmonious nervous system regulation. To create a beautifully seamless and comfortable experience, please complete these steps before we connect:')}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="padding:14px 0;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">Create Your Sanctuary</p>
        <p style="margin:0;font-size:14px;line-height:1.75;color:#4a4540;font-family:Georgia,serif;">Choose a completely private space where you have total solitude to focus entirely on your transformation.</p>
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">Prioritize Physical Comfort</p>
        <p style="margin:0;font-size:14px;line-height:1.75;color:#4a4540;font-family:Georgia,serif;">Use the restroom prior to our call so you can remain fully present throughout the experience.</p>
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">Power Your Connection</p>
        <p style="margin:0;font-size:14px;line-height:1.75;color:#4a4540;font-family:Georgia,serif;">Ensure your device is fully charged and actively plugged into a continuous power source.</p>
      </td></tr>
      <tr><td style="padding:14px 0;border-bottom:1px solid #F0EBE3;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">Protect Your Peace</p>
        <p style="margin:0;font-size:14px;line-height:1.75;color:#4a4540;font-family:Georgia,serif;">Activate "Do Not Disturb" on your devices to pause all notifications and maintain deep, continuous focus.</p>
      </td></tr>
      <tr><td style="padding:14px 0;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">Begin Conditioning Your Mind Now</p>
        <p style="margin:0;font-size:14px;line-height:1.75;color:#4a4540;font-family:Georgia,serif;">I'd love to invite you to start listening to my <strong>Nervous System Regulation</strong> hypnosis audio — a free gift when you join my email list. Listen with headphones <strong>every morning as you wake up</strong> and <strong>every night as you fall asleep</strong>. This gently conditions your mind to drop into hypnosis more quickly and deeply, so when we work together live you'll go even further, faster.</p>
        <div style="margin:14px 0 4px;">${ctaButton('Get the Free Audio →', FREEBIE_URL)}</div>
      </td></tr>
    </table>
    ${p('I look forward to guiding you through this magnificent journey and into expressing your highest potential ✨')}

    ${divider()}

    ${consentSignature ? `
    ${sectionHeading('Consent Record')}
    ${label('Signed by')}
    ${answer(consentSignature)}
    ${label('Date')}
    ${answer(consentDate || '')}
    ${divider()}
    ` : ''}
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
    subject: 'Your Session is Confirmed — Prepare for Our Time Together',
    html: branded('Your session<br>is confirmed.', body),
  });
}

/**
 * sendAudioConfirmation
 * Fired once after a successful audio/guide purchase, with download links.
 * Detects whether the purchase includes a PDF guide and/or audio files
 * and shows the appropriate instructions for each.
 */
async function sendAudioConfirmation(to, { productName, files, isInstagram = false, isAudit = false }) {
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

  const hasPDF   = files.some(f => f.name.toLowerCase().endsWith('.pdf'));
  const hasAudio = files.some(f => f.name.toLowerCase().match(/\.(mp3|m4a|wav|aac)$/));

  let instructionsHtml = '';

  if (hasPDF && hasAudio) {
    // Guide + Audio bundle: guide instructions + audio instructions + 1:1 upsell
    instructionsHtml = `
      ${p('Thank you for purchasing! I hope that you enjoy this guidebook on how to master the game of Instagram. It really contains all of the information I wish I had when I was just getting started. I\'d recommend reading through it all and becoming familiar with all of the concepts before starting to take action on your page.')}
      ${p('Good luck!')}
      ${divider()}
      ${p('For the hypnosis audio, listen with headphones every morning upon waking AND as you fall asleep at night. The timing matters. Repeat daily for a <em>minimum</em> of 21 days, and continue beyond that until you feel the shifts have become permanent. I listen to some for 3–6 months straight, or until I feel that a particular recording has fully integrated. This part matters: neuroplasticity requires consistent repetition to create lasting re-patterning at the subconscious level.')}
      ${divider()}
      ${isAudit
        ? p('And thank you for booking the live session — I\'m excited to support your most effective expansion.')
        : `${p('And if you are looking for deeper, personalised support — I offer 1:1 Instagram audit & strategy sessions where we meet you where you\'re at, and I hold your hand through creating a plan for the process of closing the gap between where you are, and where you want to be with your account expansion.')}
      <div style="margin:4px 0 28px;">
        ${ctaButton('Book a 1:1 Strategy Session →', `${SITE}/socialgrowth#audit`)}
      </div>`}
    `;
  } else if (hasPDF && isInstagram && productName.toLowerCase().includes('audit')) {
    // Guide + Strategy Session: guide instructions + audio upsell
    instructionsHtml = `
      ${p('Thank you for purchasing! I hope that you enjoy this guidebook on how to master the game of Instagram. It really contains all of the information I wish I had when I was just getting started. I\'d recommend reading through it all and becoming familiar with all of the concepts before starting to take action on your page.')}
      ${p('Good luck!')}
      ${divider()}
      ${p('And as a little bonus tip — if you really want to accelerate your results, consider pairing the guide with the Instagram Identity Shift hypnosis audio. It works directly on your inner identity to shift your subconscious into the version of you that genuinely enjoys content creation and feels deeply safe being seen. The outer strategy in the guide works dramatically better when the inner resistance is cleared first.')}
      <div style="margin:4px 0 28px;">
        ${ctaButton('Get the Instagram Identity Shift Audio →', `${SITE}/socialgrowth#audio`)}
      </div>
    `;
  } else if (hasPDF) {
    // Guide only: guide instructions + audio upsell
    instructionsHtml = `
      ${p('Thank you for purchasing! Please enjoy this 33 paged guidebook on how to master the game of Instagram. I\'d recommend reading through it all and becoming familiar with all of the concepts before taking action on your page.')}
      ${p('And if you want to go even deeper with internal strategy, don\'t forget there\'s a 15 minute binaural beats hypnosis audio available to shift your subconscious wiring into the identity of someone who is highly successful at Instagram, feels deeply safe being visible and thoroughly enjoys the process.')}
      <div style="margin:4px 0 28px;">
        ${ctaButton('Get the Instagram Identity Shift Audio →', `${SITE}/socialgrowth#audio`)}
      </div>
      ${p('Good luck!')}
    `;
  } else if (hasAudio) {
    // Audio only: listening instructions + guide upsell (Instagram only)
    instructionsHtml = `
      ${p('For best results, listen with headphones every morning upon waking AND as you fall asleep at night. The timing matters.<br><br>Repeat daily for a <em>minimum</em> of 21 days, and continue beyond that until you feel the shifts have become permanent. I listen to some for 3–6 months straight, or until I feel that a particular recording has fully integrated. This part matters: neuroplasticity requires consistent repetition to create lasting re-patterning at the subconscious level.')}
      ${isInstagram ? `
      ${p('And if you want to master the external side of Instagram too, don\'t forget there\'s a 33 page guidebook covering the complete outer strategy — the exact system I used to grow from 12,000 to 65,000 followers in under 3 months.')}
      <div style="margin:4px 0 28px;">
        ${ctaButton('Get the Instagram Strategy Guide →', `${SITE}/socialgrowth`)}
      </div>
      ` : ''}
    `;
  }

  const body = `
    ${p('Your payment is confirmed. Your downloads are ready below — save them to your device so you always have access.')}
    ${divider()}
    ${sectionHeading(productName)}
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E2D8;margin-bottom:28px;">
      ${fileLinks}
    </table>
    ${instructionsHtml}
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
 * notifyIntakeReceived
 * Fired when the client submits the intake form.
 * Sends Isis an internal notification with the full intake + consent record
 * so she can prepare for the session. Not sent when consent alone is signed —
 * the consent record is included here as part of the intake notification.
 */
async function notifyIntakeReceived({ name, email, phone, focus, manifestation, duration, childhood, outcome, previous, medical, hypno, extra, consentSignature, consentDate }) {
  const body = `
    ${p(`New intake form submitted by <strong>${name || 'Unknown'}</strong>.`)}
    ${divider()}
    ${sectionHeading('Contact')}
    ${label('Name')}
    ${answer(name)}
    ${label('Email')}
    ${answer(email)}
    ${label('Phone')}
    ${answer(phone)}
    ${divider()}
    ${consentSignature ? `
    ${sectionHeading('Consent Record')}
    ${label('Signed by')}
    ${answer(consentSignature)}
    ${label('Date')}
    ${answer(consentDate || '')}
    ${divider()}
    ` : ''}
    ${sectionHeading('Intake Responses')}
    ${label('What they want to shift')}
    ${answer(focus)}
    ${label('How it shows up in their life')}
    ${answer(manifestation)}
    ${label('How long they\'ve been experiencing this')}
    ${answer(duration)}
    ${label('Childhood environment & significant early experiences')}
    ${answer(childhood)}
    ${label('Desired outcome')}
    ${answer(outcome)}
    ${label('What they\'ve already tried')}
    ${answer(previous)}
    ${label('Medical / mental health notes')}
    ${answer(medical)}
    ${label('Experienced hypnotherapy before')}
    ${answer(hypno)}
    ${extra ? `${label('Anything else')}${answer(extra)}` : ''}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: email || REPLY_TO,
    to: REPLY_TO,
    subject: `New Intake Form — ${name || 'Unknown'}`,
    html: branded('New intake form<br>received.', body),
  });
}

async function notifyCustomAudioReceived({ name, email, goal, feel, vision }) {
  const body = `
    ${p(`New custom hypnosis audio order received from <strong>${name || 'Unknown'}</strong>.`)}
    ${divider()}
    ${sectionHeading('Contact')}
    ${label('Name')}
    ${answer(name)}
    ${label('Email')}
    ${answer(email)}
    ${divider()}
    ${sectionHeading('Brief')}
    ${label('What they want to shift or call in')}
    ${answer(goal)}
    ${label('How they want to feel')}
    ${answer(feel)}
    ${label('Their vision / context')}
    ${answer(vision)}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: email || REPLY_TO,
    to: REPLY_TO,
    subject: `New Custom Audio Order — ${name || 'Unknown'}`,
    html: branded('New custom audio order<br>received.', body),
  });
}

async function notifyCustomAudioPaymentReceived({ name, email, sessionId, amount, currency }) {
  const formattedAmount = amount != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(amount)
    : '—';

  const body = `
    ${p(`A custom hypnosis audio order was just paid for by <strong>${name || email || 'a customer'}</strong>.`)}
    ${divider()}
    ${label('Name')}
    ${answer(name || '—')}
    ${label('Email')}
    ${answer(email || '—')}
    ${label('Amount paid')}
    ${answer(formattedAmount)}
    ${label('Stripe session ID')}
    ${answer(sessionId || '—')}
    ${divider()}
    ${p('They have not yet submitted the brief questionnaire. If they don\'t complete it shortly, you may want to follow up directly using the email above.')}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: email || REPLY_TO,
    to: REPLY_TO,
    subject: `💰 ${formattedAmount} — Custom Audio Payment Received (${name || email || 'Unknown'})`,
    html: branded('Custom audio<br>payment received.', body),
  });
}

async function notifyAudioPurchaseReceived({ name, email, audioNames, productName, amount, currency, purchaseLabel = 'Audio Purchase' }) {
  const audioList = Array.isArray(audioNames) && audioNames.length
    ? audioNames.map(n => `• ${n}`).join('<br>')
    : '—';

  const formattedAmount = amount != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(amount)
    : '—';

  const body = `
    ${p(`A hypnosis audio purchase was just completed by <strong>${name || email || 'a customer'}</strong>.`)}
    ${divider()}
    ${label('Name')}
    ${answer(name || '—')}
    ${label('Email')}
    ${answer(email || '—')}
    ${label('Amount paid')}
    ${answer(formattedAmount)}
    ${label('Product')}
    ${answer(productName || '—')}
    ${label('Audios purchased')}
    ${answer(audioList)}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: email || REPLY_TO,
    to: REPLY_TO,
    subject: `💰 ${formattedAmount} — ${purchaseLabel} (${name || email || 'Unknown'})`,
    html: branded('New audio<br>purchase.', body),
  });
}

module.exports = { sendPaymentConfirmation, sendSessionConfirmation, sendAudioConfirmation, notifyIntakeReceived, notifyCustomAudioReceived, notifyCustomAudioPaymentReceived, notifyAudioPurchaseReceived, notifyRTTSessionBooked };

async function notifyRTTSessionBooked({ name, email, sessionId, amount, currency, productName }) {
  const formattedAmount = amount != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(amount)
    : '—';

  const body = `
    ${p(`A new RTT™ session was just booked and paid for by <strong>${name || email || 'a customer'}</strong>.`)}
    ${divider()}
    ${label('Name')}
    ${answer(name || '—')}
    ${label('Email')}
    ${answer(email || '—')}
    ${label('Amount paid')}
    ${answer(formattedAmount)}
    ${label('Package')}
    ${answer(productName || '—')}
    ${label('Stripe session ID')}
    ${answer(sessionId || '—')}
    ${divider()}
    ${p('They will receive a confirmation email asking them to complete the intake form before your session together.')}
  `;

  return resend.emails.send({
    from: FROM,
    reply_to: email || REPLY_TO,
    to: REPLY_TO,
    subject: `💰 ${formattedAmount} — RTT™ Session Booked (${name || email || 'Unknown'})`,
    html: branded('New RTT™ session<br>booked.', body),
  });
}
