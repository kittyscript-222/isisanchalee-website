// api/deliver-audio.js
// POST /api/deliver-audio  (multipart/form-data)
// Fields: email, clientName, sessionNote (optional), audio (file)
// Uploads the bespoke hypnosis audio to Google Drive, then emails
// the client a branded delivery email with a download link.

const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const { uploadAudioFile } = require('../lib/drive');

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = `Isis Anchalee <${process.env.FROM_EMAIL || 'hello@isisanchalee.com'}>`;
const REPLY_TO = process.env.REPLY_TO_EMAIL || 'isisanchalee@gmail.com';
const SITE    = process.env.SITE_URL || 'https://isisanchalee.com';

// Google Drive folder where bespoke audios are stored.
// Create a folder, share it with your service account (Editor), and paste the ID here.
const BESPOKE_FOLDER_ID = process.env.BESPOKE_AUDIO_FOLDER_ID || '';

const ALLOWED_TYPES = ['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/m4a','audio/x-m4a'];

// Disable Vercel's default body parser so formidable can handle multipart
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ADMIN_URL || process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── 1. Parse multipart ────────────────────────────────────────────────────
  const form = formidable({ maxFileSize: 150 * 1024 * 1024, keepExtensions: true });
  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (err) {
    console.error('Form parse error:', err);
    return res.status(400).json({ error: 'Failed to parse upload' });
  }

  const email      = Array.isArray(fields.email)       ? fields.email[0]       : fields.email;
  const clientName = Array.isArray(fields.clientName)  ? fields.clientName[0]  : fields.clientName;
  const sessionNote= Array.isArray(fields.sessionNote) ? fields.sessionNote[0] : fields.sessionNote;
  const audioFile  = Array.isArray(files.audio)        ? files.audio[0]        : files.audio;

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  if (!audioFile) return res.status(400).json({ error: 'Audio file required' });

  // ── 2. Validate file type ─────────────────────────────────────────────────
  const mimeType = audioFile.mimetype || 'audio/mpeg';
  const ext      = path.extname(audioFile.originalFilename || '').toLowerCase();
  if (!ALLOWED_TYPES.includes(mimeType) && !['.mp3','.wav','.m4a','.mp4'].includes(ext)) {
    return res.status(400).json({ error: 'Only MP3, WAV, or M4A files are supported' });
  }

  // Sanitise filename: "Client Name - Hypnosis Audio.mp3"
  const safeName = clientName
    ? `${clientName.replace(/[^a-zA-Z0-9 ]/g, '').trim()} - Hypnosis Audio${ext || '.mp3'}`
    : `Bespoke Hypnosis Audio${ext || '.mp3'}`;

  // ── 3. Read file ──────────────────────────────────────────────────────────
  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(audioFile.filepath);
  } catch (err) {
    console.error('File read error:', err);
    return res.status(500).json({ error: 'Failed to read uploaded file' });
  }

  const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(1);

  // ── 4. Upload to Google Drive ─────────────────────────────────────────────
  let downloadUrl, fileId;
  try {
    const result = await uploadAudioFile(fileBuffer, safeName, mimeType, BESPOKE_FOLDER_ID);
    downloadUrl = result.downloadUrl;
    fileId = result.fileId;
    console.log(`Uploaded to Drive: ${safeName} (${fileId})`);
  } catch (err) {
    console.error('Drive upload error:', err);
    return res.status(500).json({ error: 'Failed to upload audio to Drive: ' + err.message });
  } finally {
    // Clean up temp file regardless
    try { fs.unlinkSync(audioFile.filepath); } catch(_) {}
  }

  // ── 5. Send branded email with download link ──────────────────────────────
  const firstName = clientName ? clientName.split(' ')[0] : 'there';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#EDEAE4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EDEAE4;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#F9F8F2;padding:36px 44px 30px;">
    <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">✦ &nbsp;Isis Anchalee</p>
    <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:400;line-height:1.25;color:#0E0B08;">Your bespoke<br><em style="font-style:italic;color:#B8975A;">hypnosis audio</em></h1>
  </td></tr>

  <tr><td style="background:#ffffff;padding:36px 44px;">
    <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">It was a real honour sitting with you in our session. What you were willing to look at and move through speaks to the depth of your commitment to your own evolution.</p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">Your personalised hypnosis recording is ready — crafted from everything that emerged in our session and designed to continue the integration work at the deepest level.</p>

    <div style="text-align:center;margin:0 0 32px;">
      <a href="${downloadUrl}" style="display:inline-block;padding:15px 36px;background:#B8975A;color:#ffffff;font-family:Georgia,serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;">Download Your Audio →</a>
    </div>

    <div style="height:1px;background:#F0EBE3;margin:0 0 28px;"></div>

    <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">How to use your audio</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.8;color:#4a4540;font-family:Georgia,serif;">Listen with headphones every morning upon waking <strong>and</strong> as you fall asleep at night. These are the moments your brain is most receptive to subconscious reprogramming.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.8;color:#4a4540;font-family:Georgia,serif;">Repeat daily for a <strong>minimum of 21 days</strong> and continue until the shifts have fully integrated. Neuroplasticity requires consistent repetition — this part is non-negotiable.</p>

    ${sessionNote ? `
    <div style="height:1px;background:#F0EBE3;margin:0 0 28px;"></div>
    <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">A note from Isis</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.8;color:#4a4540;padding-left:14px;border-left:2px solid #E0D5C5;font-family:Georgia,serif;">${sessionNote}</p>
    ` : ''}

    <div style="height:1px;background:#F0EBE3;margin:0 0 28px;"></div>
    <p style="margin:0;font-size:15px;line-height:1.8;color:#3a3530;font-family:Georgia,serif;">With love,<br><em style="color:#B8975A;">Isis</em></p>
  </td></tr>

  <tr><td style="background:#F9F8F2;padding:24px 44px 32px;border-top:1px solid rgba(184,151,90,0.18);">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;font-family:Georgia,serif;">Isis Anchalee</p>
    <p style="margin:0;font-size:12px;color:rgba(14,11,8,0.4);line-height:1.7;font-family:Georgia,serif;">
      RTT™ Hypnotherapist &amp; Consciousness Guide<br>
      <a href="${SITE}" style="color:#B8975A;text-decoration:none;">isisanchalee.com</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: FROM,
      reply_to: REPLY_TO,
      to: email,
      subject: 'Your Bespoke Hypnosis Audio — Isis Anchalee',
      html,
    });

    console.log(`Delivery email sent to ${email} | Drive file: ${fileId} | ${fileSizeMB}MB`);
    return res.status(200).json({ success: true, fileSizeMB, fileId });

  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Audio uploaded but email failed: ' + err.message });
  }
};
