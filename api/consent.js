// api/consent.js
// POST /api/consent
// Logs the signed consent record to Google Sheets immediately when
// the client clicks "Agree & Continue" — before the intake form is filled out.

const { logConsentRecord } = require('../lib/sheets');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, consentSignature, consentDate, sessionId } = req.body;

  if (!consentSignature) {
    return res.status(400).json({ error: 'No signature provided' });
  }

  try {
    await logConsentRecord({ name, consentSignature, consentDate, sessionId });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Consent log error:', err);
    return res.status(500).json({ error: 'Failed to log consent' });
  }
};
