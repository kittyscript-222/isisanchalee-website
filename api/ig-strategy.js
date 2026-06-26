// api/ig-strategy.js
// POST /api/ig-strategy
// Receives the Instagram strategy session pre-session questionnaire,
// sends the client a copy of their responses, and notifies Isis.

const { sendIGStrategyConfirmation, notifyIGStrategyReceived } = require('../lib/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, email,
    q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
    q11, q12, q13, q14, q15, q16, q17, q18,
  } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  console.log('ig-strategy submission:', JSON.stringify({ name, email }));

  // ── 1. Send copy of responses to client ──────────────────────────────────
  try {
    await sendIGStrategyConfirmation(email, {
      name, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
      q11, q12, q13, q14, q15, q16, q17, q18,
    });
  } catch (err) {
    console.error('Client confirmation email error:', err);
  }

  // ── 2. Notify Isis with all responses ────────────────────────────────────
  try {
    await notifyIGStrategyReceived({
      name, email, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
      q11, q12, q13, q14, q15, q16, q17, q18,
    });
  } catch (err) {
    console.error('Internal notification error:', err);
  }

  return res.status(200).json({ success: true });
};
