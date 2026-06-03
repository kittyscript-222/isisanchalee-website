// lib/drive.js
// Google Drive helpers using a Service Account (no OAuth flow needed)
// Supports downloading existing files and uploading new bespoke audio files.

const { google } = require("googleapis");
const { Readable } = require("stream");

function getDriveClient(readOnly = true) {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: readOnly
      ? ["https://www.googleapis.com/auth/drive.readonly"]
      : ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Returns a direct download URL for a Google Drive file.
 * The file must be shared with the service account email (Viewer).
 */
async function getDownloadUrl(fileId) {
  const drive = getDriveClient();
  await drive.files.get({ fileId, fields: "id, name" });
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Returns download URLs for an array of file objects
 */
async function getDownloadUrls(files) {
  return Promise.all(
    files.map(async (f) => ({
      name: f.name,
      url: await getDownloadUrl(f.driveFileId),
    }))
  );
}

/**
 * Uploads a buffer to a specific Google Drive folder and returns the file ID and share link.
 * The folder must be shared with the service account email (Editor).
 *
 * @param {Buffer} buffer        - File contents
 * @param {string} fileName      - e.g. "client-name-hypnosis.mp3"
 * @param {string} mimeType      - e.g. "audio/mpeg"
 * @param {string} folderId      - Google Drive folder ID to upload into
 * @returns {Promise<{fileId: string, webViewLink: string, downloadUrl: string}>}
 */
async function uploadAudioFile(buffer, fileName, mimeType, folderId) {
  const drive = getDriveClient(false); // needs write scope

  // Convert buffer to readable stream for the Drive API
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : [],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, webViewLink, webContentLink",
  });

  const fileId = response.data.id;

  // Make the file accessible to anyone with the link so the client can download it
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  // Direct download link (bypasses Drive preview page)
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  return {
    fileId,
    webViewLink: response.data.webViewLink,
    downloadUrl,
  };
}

module.exports = { getDownloadUrl, getDownloadUrls, uploadAudioFile };
