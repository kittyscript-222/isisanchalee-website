// lib/sheets.js
// Appends consent records to a Google Sheet using the same Service Account
// already configured for Google Drive.
//
// Setup required:
//   1. Create a Google Sheet (or use an existing one).
//   2. Share it with the service account email
//      (GOOGLE_SERVICE_ACCOUNT_EMAIL — same as used for Drive) as Editor.
//   3. Copy the Sheet ID from its URL:
//      https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
//   4. Set it as an env var: CONSENT_SHEET_ID
//   5. Add a header row to the first sheet/tab (any name is fine, defaults to
//      the first sheet) with these columns in order:
//      Timestamp | Name | Email | Phone | Signature | Consent Date | Session ID

const { google } = require('googleapis');

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Appends a single consent record as a new row.
 *
 * @param {Object} record
 * @param {string} record.name
 * @param {string} record.email
 * @param {string} record.phone
 * @param {string} record.consentSignature
 * @param {string} record.consentDate
 * @param {string} [record.sessionId]
 */
async function logConsentRecord({ name, email, phone, consentSignature, consentDate, sessionId }) {
  const sheetId = process.env.CONSENT_SHEET_ID;
  if (!sheetId) {
    console.error('CONSENT_SHEET_ID not set — skipping consent log');
    return;
  }

  const sheets = getSheetsClient();

  const row = [
    new Date().toISOString(),     // Timestamp (server-side, authoritative)
    name || '',
    email || '',
    phone || '',
    consentSignature || '',
    consentDate || '',
    sessionId || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'A:G',                 // first sheet/tab, columns A through G
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

module.exports = { logConsentRecord };
