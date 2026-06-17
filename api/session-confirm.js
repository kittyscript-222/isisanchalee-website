// api/session-confirm.js
// POST /api/session-confirm
// Called immediately when session-success.html loads with a valid session_id.
// Verifies the Stripe payment and sends an instant confirmation email with
// a link back to the intake form — in case they close the tab before filling it out.

const Stripe = require('stripe');
const { sendPaymentConfirmation } = require('../lib/email');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    // Only send once — check metadata flag
    const alreadySent = session.metadata?.paymentEmailSent === 'true';
    const clientEmail = session.customer_details?.email;
    const clientName  = session.customer_details?.name;

    if (!alreadySent && clientEmail) {
      await sendPaymentConfirmation(clientEmail, { name: clientName, sessionId });

      // Mark as sent so page refreshes don't resend
      await stripe.checkout.sessions.update(sessionId, {
        metadata: { ...session.metadata, paymentEmailSent: 'true' },
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Session confirm error:', err);
    return res.status(500).json({ error: 'Failed to confirm session' });
  }
};
