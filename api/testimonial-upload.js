// api/testimonial-upload.js
// POST /api/testimonial-upload
// Receives a video file (multipart) and uploads it to Google Drive.
// Returns { fileId, webViewLink } on success.

const { uploadAudioFile } = require('../lib/drive');

// Disable Vercel's default body parser — we need raw multipart stream
module.exports.config = { api: { bodyParser: false } };

// Parse multipart/form-data without a heavy dependency
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const boundary = (() => {
      const ct = req.headers['content-type'] || '';
      const m = ct.match(/boundary=(.+)$/);
      return m ? m[1] : null;
    })();

    if (!boundary) return reject(new Error('No boundary found'));

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const sep = Buffer.from(`--${boundary}`);
      const parts = [];
      let start = 0;

      while (start < buf.length) {
        const sepIdx = buf.indexOf(sep, start);
        if (sepIdx === -1) break;
        const contentStart = sepIdx + sep.length + 2; // skip \r\n
        const nextSep = buf.indexOf(sep, contentStart);
        if (nextSep === -1) break;
        const partBuf = buf.slice(contentStart, nextSep - 2); // trim trailing \r\n
        const headerEnd = partBuf.indexOf('\r\n\r\n');
        if (headerEnd === -1) { start = nextSep; continue; }
        const headerStr = partBuf.slice(0, headerEnd).toString();
        const body = partBuf.slice(headerEnd + 4);
        parts.push({ headers: headerStr, body });
        start = nextSep;
      }

      const fields = {};
      let file = null;
      for (const part of parts) {
        const nameMatch = part.headers.match(/name="([^"]+)"/);
        const fileMatch = part.headers.match(/filename="([^"]+)"/);
        const ctMatch  = part.headers.match(/Content-Type:\s*([^\r\n]+)/i);
        if (!nameMatch) continue;
        const fieldName = nameMatch[1];
        if (fileMatch) {
          file = {
            fieldName,
            filename: fileMatch[1],
            mimeType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
            buffer: part.body,
          };
        } else {
          fields[fieldName] = part.body.toString().trim();
        }
      }

      resolve({ fields, file });
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { fields, file } = await parseMultipart(req);

    if (!file) return res.status(400).json({ error: 'No file received' });

    const sessionType = fields.type === 'ig-strategy' ? 'ig-strategy' : 'rtt';
    const clientName  = (fields.name || 'client').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const ext         = file.filename.split('.').pop() || 'mp4';
    const fileName    = `${sessionType}-testimonial-${clientName}-${Date.now()}.${ext}`;
    const folderId    = process.env.TESTIMONIAL_VIDEO_FOLDER_ID;

    const result = await uploadAudioFile(file.buffer, fileName, file.mimeType, folderId);

    return res.status(200).json({ fileId: result.fileId, webViewLink: result.webViewLink });
  } catch (err) {
    console.error('testimonial-upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
};
