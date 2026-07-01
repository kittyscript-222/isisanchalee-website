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

module.exports = { logConsentRecord, logFreeAudioLead, logFollowUpSchedule, getAndMarkDueFollowUps };

/**
 * Appends a follow-up email schedule row.
 * Sheet columns: Timestamp | Name | Email | Type | SendAt | Sent
 *
 * Setup: create a Google Sheet, share with service account as Editor,
 * set FOLLOWUP_SHEET_ID env var. Header row: Timestamp|Name|Email|Type|SendAt|Sent
 *
 * @param {Object} record
 * @param {string} record.name
 * @param {string} record.email
 * @param {'rtt'|'ig-strategy'} record.type
 * @param {string} record.sendAt  — ISO date string (30 days from session)
 */
async function logFollowUpSchedule({ name, email, type, sendAt }) {
  const sheetId = process.env.FOLLOWUP_SHEET_ID;
  if (!sheetId) { console.error('FOLLOWUP_SHEET_ID not set — skipping follow-up schedule'); return; }

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'A:F',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[new Date().toISOString(), name || '', email || '', type || '', sendAt || '', 'false']] },
  });
}

/**
 * Reads all rows where SendAt <= today and Sent = false,
 * marks them as sent (column F = 'true'), and returns them.
 *
 * @returns {Promise<Array<{name, email, type, rowIndex}>>}
 */
async function getAndMarkDueFollowUps() {
  const sheetId = process.env.FOLLOWUP_SHEET_ID;
  if (!sheetId) { console.error('FOLLOWUP_SHEET_ID not set'); return []; }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'A:F' });
  const rows = res.data.values || [];

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = [];
  const updates = [];

  rows.forEach((row, i) => {
    if (i === 0) return; // skip header
    const [, name, email, type, sendAt, sent] = row;
    if (!email || !sendAt || sent === 'true') return;
    if (new Date(sendAt) <= today) {
      due.push({ name, email, type, rowIndex: i + 1 });
      updates.push({ range: `F${i + 1}`, values: [['true']] });
    }
  });

  // Mark all due rows as sent in one batch
  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });
  }

  return due;
}

/**
 * Appends a single free-audio lead (name + email) as a new row to the
 * dedicated leads sheet. Used by the links page signup form.
 *
 * @param {Object} record
 * @param {string} record.name
 * @param {string} record.email
 */
async function logFreeAudioLead({ name, email }) {
  const sheetId = process.env.FREE_AUDIO_SHEET_ID;
  if (!sheetId) {
    console.error('FREE_AUDIO_SHEET_ID not set — skipping free audio lead log');
    return;
  }

  const sheets = getSheetsClient();

  const row = [
    new Date().toISOString(), // Timestamp (server-side, authoritative)
    name || '',
    email || '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'A:C', // first sheet/tab, columns A through C
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}
