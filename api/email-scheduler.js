// api/email-scheduler.js
// GET /api/email-scheduler
// Called daily by Vercel Cron. Checks FOLLOWUP_SHEET_ID for pending 30-day
// follow-up emails and sends them.
//
// Required env vars:
//   CRON_SECRET         — set in Vercel, must match Authorization header sent by Vercel Cron
//   FOLLOWUP_SHEET_ID   — Google Sheet ID for the follow-up schedule
//
// vercel.json cron config fires this daily at 09:00 UTC.

const { getAndMarkDueFollowUps } = require('../lib/sheets');
const { sendRTTFollowUp, sendIGStrategyFollowUp } = require('../lib/email');

module.exports = async function handler(req, res) {
  // Vercel Cron passes the secret as a Bearer token
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const due = await getAndMarkDueFollowUps();

    const results = await Promise.allSettled(
      due.map(({ name, email, type }) => {
        if (type === 'ig-strategy') return sendIGStrategyFollowUp(email, { name });
        return sendRTTFollowUp(email, { name });
      })
    );

    const sent     = results.filter(r => r.status === 'fulfilled').length;
    const failed   = results.filter(r => r.status === 'rejected').length;

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Follow-up failed for ${due[i]?.email}:`, r.reason);
      }
    });

    console.log(`email-scheduler: ${sent} sent, ${failed} failed out of ${due.length} due`);
    return res.status(200).json({ sent, failed, total: due.length });

  } catch (err) {
    console.error('email-scheduler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
