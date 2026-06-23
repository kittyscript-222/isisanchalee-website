// api/deliver.js
// GET /api/deliver?session_id=cs_xxx
// Verifies a completed Stripe payment and returns the download links
// for the files the buyer is entitled to. Called client-side from the
// socialgrowth.html post-purchase overlay.

const Stripe = require('stripe');
const { PRODUCTS } = require('../lib/products');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  console.log('deliver request for session:', session_id);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      console.error('deliver: session not paid', session_id, session.payment_status);
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const productId = session.metadata?.productId;
    if (!productId) {
      console.error('deliver: no productId in session metadata', session_id);
      return res.status(404).json({ error: 'No product found for this session' });
    }

    const product = PRODUCTS[productId];
    if (!product) {
      console.error('deliver: unknown productId', productId);
      return res.status(404).json({ error: 'Product not found' });
    }

    // Sessions (RTT, audit-only) have no files — caller should redirect to
    // calendar instead of calling this endpoint, but handle gracefully.
    const files = (product.files || []).map(f => ({
      name: f.name,
      url: `https://drive.google.com/uc?export=download&id=${f.driveFileId}`,
      // Also provide a viewable link (opens in browser) as fallback
      viewUrl: `https://drive.google.com/file/d/${f.driveFileId}/view`,
    }));

    console.log('deliver: serving', files.length, 'file(s) for', productId, 'to', session.customer_details?.email);

    return res.status(200).json({
      productId,
      productName: product.name,
      customerEmail: session.customer_details?.email || null,
      files,
    });
  } catch (err) {
    console.error('deliver error:', err);
    return res.status(500).json({ error: 'Failed to retrieve purchase details' });
  }
};
