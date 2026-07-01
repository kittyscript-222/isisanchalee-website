// api/proxy-audio.js
// GET /api/proxy-audio?fileId=DRIVE_FILE_ID
// Streams a Google Drive file through the server so the browser isn't blocked
// by Google's cross-origin response headers on drive.google.com/uc URLs.

const { google } = require('googleapis');

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { fileId } = req.query;
  if (!fileId) return res.status(400).json({ error: 'fileId is required' });

  try {
    const drive = getDriveClient();

    // Fetch file metadata to get the name and mime type
    const meta = await drive.files.get({ fileId, fields: 'name, mimeType, size' });
    const { name, mimeType, size } = meta.data;

    // Stream the file contents
    const fileRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    if (size) res.setHeader('Content-Length', size);

    fileRes.data.pipe(res);
  } catch (err) {
    console.error('proxy-audio error:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
};
