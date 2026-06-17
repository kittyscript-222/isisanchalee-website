// api/downloads.js
const Stripe = require('stripe');
const { PRODUCTS, AUDIO_BY_NAME } = require('../lib/products');
const { getDownloadUrls } = require('../lib/drive');
const { sendAudioConfirmation, notifyAudioPurchaseReceived } = require('../lib/email');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id is required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['customer_details', 'line_items'],
    });
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    // Get all selected audio names from metadata
    const audioNames = JSON.parse(session.metadata?.audioNames || '[]');
    if (!audioNames.length) return res.status(400).json({ error: 'No audio names found' });

    // Resolve files for every selected audio
    const filesToDeliver = audioNames
      .map(name => AUDIO_BY_NAME[name])
      .filter(Boolean)
      .flatMap(p => p.files);

    if (!filesToDeliver.length) {
      return res.status(400).json({ error: 'No files found for selected audios' });
    }

    const files = await getDownloadUrls(filesToDeliver);
    const productName = `${audioNames.length} Hypnosis Audio${audioNames.length > 1 ? 's' : ''}`;

    // Send confirmation email once
    if (!session.metadata?.emailSent) {
      const email = session.customer_details?.email;
      if (email) {
        try {
          await sendAudioConfirmation(email, { productName, files });
          await stripe.checkout.sessions.update(session_id, {
            metadata: { ...session.metadata, emailSent: 'true' },
          });
        } catch (emailErr) {
          console.error('Email send error:', emailErr);
        }

        // Internal notification to Isis
        try {
          await notifyAudioPurchaseReceived({
            name: session.customer_details?.name,
            email: session.customer_details?.email,
            audioNames,
            productName,
            amount: session.amount_total != null ? session.amount_total / 100 : null,
            currency: session.currency || 'usd',
          });
        } catch (notifyErr) {
          console.error('Internal notification error:', notifyErr);
        }
      }
    }

    return res.status(200).json({
      productName,
      files,
      transaction: {
        id: session.id,
        value: session.amount_total / 100,
        currency: (session.currency || 'usd').toUpperCase(),
        items: audioNames.map(name => ({
          item_name: name,
          quantity: 1,
        })),
      },
    });

  } catch (err) {
    console.error('Downloads error:', err);
    return res.status(500).json({ error: 'Failed to retrieve downloads' });
  }
};
