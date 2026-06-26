// api/checkout.js
const Stripe = require('stripe');
const { PRODUCTS } = require('../lib/products');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audioNames = [], productId } = req.body;

  // ── SESSION CHECKOUT ──────────────────────────────────────────────────────
  const sessionIds = ['rtt_single_supported','rtt_single_standard','rtt_single_abundant','rtt_pack_3_supported','rtt_pack_3_standard','rtt_pack_3_abundant','custom_audio'];
  if (productId && sessionIds.includes(productId)) {
    const product = PRODUCTS[productId];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: product.stripePriceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: productId === 'custom_audio' ? `${process.env.SITE_URL}/custom-audio.html?paid=1` : `${process.env.SITE_URL}/session-success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_URL}/shop.html`,
        metadata: { productId },
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('Session checkout error:', err);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  // ── INSTAGRAM GUIDE / AUDIO / AUDIT CHECKOUT ───────────────────────────────
  const instagramProductIds = ['instagram_guide','instagram_guide_bundle','instagram_guide_audit','instagram_guide_audio_audit','magnetic_growth_audio','instagram_audit_session'];
  const instagramAuditIds = ['instagram_guide_audit','instagram_guide_audio_audit','instagram_audit_session'];
  if (productId && instagramProductIds.includes(productId)) {
    const product = PRODUCTS[productId];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    try {
      const isAudit = instagramAuditIds.includes(productId);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: product.stripePriceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: isAudit
          ? `${process.env.SITE_URL}/ig-strategy-questionnaire.html`
          : `${process.env.SITE_URL}/socialgrowth.html?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_URL}/socialgrowth.html`,
        metadata: { productId },
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('Instagram product checkout error:', err);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }

  if (!audioNames.length) return res.status(400).json({ error: 'No audios selected' });

  const count = audioNames.length;

  try {
    let line_items;
    let metadata = { audioNames: JSON.stringify(audioNames) };

    if (count === 10) {
      // 10 audios — bundle_10 price ($225)
      line_items = [{ price: PRODUCTS.bundle_10.stripePriceId, quantity: 1 }];
      metadata.productId = 'bundle_10';
    } else if (count > 5) {
      // 6-9 audios — bundle_5 + individual prices for the extras
      const extras = audioNames.slice(5);
      line_items = [{ price: PRODUCTS.bundle_5.stripePriceId, quantity: 1 }];
      for (const name of extras) {
        const product = Object.values(PRODUCTS).find(p => p.name === name && !p.isBundle);
        if (!product) throw new Error(`Product not found: ${name}`);
        line_items.push({ price: product.stripePriceId, quantity: 1 });
      }
      metadata.productId = 'bundle_5_plus_extras';
    } else if (count === 5) {
      // 5 audios — bundle_5 price ($165)
      line_items = [{ price: PRODUCTS.bundle_5.stripePriceId, quantity: 1 }];
      metadata.productId = 'bundle_5';
    } else if (count === 4) {
      // 4 audios — bundle_3 price + 1 individual audio ($125 + $65 = $190)
      const extraAudio = Object.values(PRODUCTS).find(p => p.name === audioNames[0] && !p.isBundle);
      if (!extraAudio) throw new Error(`Product not found: ${audioNames[0]}`);
      line_items = [
        { price: PRODUCTS.bundle_3.stripePriceId, quantity: 1 },
        { price: extraAudio.stripePriceId, quantity: 1 },
      ];
      metadata.productId = 'bundle_3_plus_1';
    } else if (count === 3) {
      // 3 audios — bundle_3 price
      line_items = [{ price: PRODUCTS.bundle_3.stripePriceId, quantity: 1 }];
      metadata.productId = 'bundle_3';
    } else {
      // 1 or 2 audios — charge individually per audio
      line_items = audioNames.map(name => {
        const product = Object.values(PRODUCTS).find(p => p.name === name);
        if (!product) throw new Error(`Product not found: ${name}`);
        return { price: product.stripePriceId, quantity: 1 };
      });
      metadata.productId = count === 1 ? Object.values(PRODUCTS).find(p => p.name === audioNames[0])?.id : 'multi_single';
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      allow_promotion_codes: true,
      success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/shop.html`,
      metadata,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
