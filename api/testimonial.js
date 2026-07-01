// api/testimonial.js
// POST /api/testimonial
// Receives written testimonial data and notifies Isis.

const { notifyTestimonialReceived } = require('../lib/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, name, email, handle, testimonial, credit, videoFileId } = req.body;
  if (!email || !testimonial) return res.status(400).json({ error: 'Missing required fields' });

  try {
    await notifyTestimonialReceived({ type, name, email, handle, testimonial, credit, videoFileId });
  } catch (err) {
    console.error('testimonial notify error:', err);
  }

  return res.status(200).json({ success: true });
};
