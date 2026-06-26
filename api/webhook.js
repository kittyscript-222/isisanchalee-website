// api/webhook.js
// POST /api/webhook
// Stripe webhook listener for checkout.session.completed.
// This fires server-side the instant payment succeeds, regardless of
// whether the customer's browser stays open or they complete any
// follow-up forms (e.g. the custom audio brief). This is the safety net
// that guarantees Isis is notified of every paid order.
//
// Required env vars:
//   STRIPE_SECRET_KEY        — your Stripe secret key
//   STRIPE_WEBHOOK_SECRET    — from the Stripe Dashboard webhook endpoint (whsec_...)
//
// Setup in Stripe Dashboard:
//   1. Developers → Webhooks → Add endpoint
//   2. Endpoint URL: https://isisanchalee.com/api/webhook
//   3. Select event: checkout.session.completed
//   4. Copy the "Signing secret" into STRIPE_WEBHOOK_SECRET in Vercel env vars

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { PRODUCTS } = require('../lib/products');
const {
  notifyCustomAudioPaymentReceived,
  notifyAudioPurchaseReceived,
  notifyRTTSessionBooked,
  sendAudioConfirmation,
} = require('../lib/email');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Disable Vercel's default body parser — Stripe requires the raw,
// unparsed request body to verify the webhook signature.
module.exports.config = { api: { bodyParser: false } };

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

// Look up a product in the catalog by its Stripe Price ID
function findProductByPriceId(priceId) {
  return Object.values(PRODUCTS).find((p) => p.stripePriceId === priceId);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  // We only care about completed checkouts
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data.object;

  try {
    // Expand line items to identify which product(s) were purchased
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'line_items.data.price'],
    });

    const lineItems = fullSession.line_items?.data || [];
    const priceIds = lineItems.map((item) => item.price?.id).filter(Boolean);
    const products = priceIds.map(findProductByPriceId).filter(Boolean);

    const name = fullSession.customer_details?.name || '';
    const email = fullSession.customer_details?.email || '';
    const amount = fullSession.amount_total != null ? fullSession.amount_total / 100 : null;
    const currency = fullSession.currency || 'usd';

    // ── Instagram guide / audio / audit products ──────────────────────────────
    // Handled separately from both the RTT session and audio-cart paths.
    // Digital products (guide, audio, bundles) send the customer a confirmation
    // email with their files. Audit products (session-based) just notify Isis.
    const instagramDigitalIds = new Set(['instagram_guide', 'instagram_guide_bundle', 'magnetic_growth_audio']);
    const instagramAuditIds   = new Set(['instagram_guide_audit', 'instagram_guide_audio_audit', 'instagram_audit_session']);
    const instagramIds        = new Set([...instagramDigitalIds, ...instagramAuditIds]);

    const instagramProducts = products.filter(p => instagramIds.has(p.id));
    const alreadyNotifiedInstagram = fullSession.metadata?.instagramNotified === 'true';

    if (instagramProducts.length && !alreadyNotifiedInstagram) {
      // Build file list across all instagram products in this purchase
      const allFiles = instagramProducts.flatMap(p =>
        (p.files || []).map(f => ({
          name: f.name,
          url: `https://drive.google.com/uc?export=download&id=${f.driveFileId}`,
        }))
      );

      const productName = instagramProducts.length === 1
        ? instagramProducts[0].name
        : instagramProducts.map(p => p.name).join(' + ');

      const isAudit = instagramProducts.some(p => instagramAuditIds.has(p.id));

      // Send customer confirmation email with download links (digital products only)
      if (allFiles.length && email) {
        try {
          await sendAudioConfirmation(email, { productName, files: allFiles, isInstagram: true, isAudit });
        } catch (err) {
          console.error('Instagram sendAudioConfirmation error:', err);
        }
      }

      const hasGuide = instagramProducts.some(p => p.id.includes('guide'));
      const hasAudio = instagramProducts.some(p => p.id === 'magnetic_growth_audio' || p.id.includes('audio'));
      const hasSession = instagramProducts.some(p => instagramAuditIds.has(p.id));
      const purchaseLabel = hasGuide && hasAudio && hasSession ? 'Guide + Audio + Strategy Session'
        : hasGuide && hasSession ? 'Guide + Strategy Session'
        : hasGuide && hasAudio ? 'Guide + Audio Purchase'
        : hasGuide ? 'Guide Purchase'
        : hasAudio ? 'Audio Purchase'
        : 'Instagram Purchase';

      // Internal notification to Isis
      try {
        await notifyAudioPurchaseReceived({
          name,
          email,
          audioNames: instagramProducts.map(p => p.name),
          productName,
          amount,
          currency,
          purchaseLabel,
          isSession: isAudit,
        });
      } catch (err) {
        console.error('Instagram notifyAudioPurchaseReceived error:', err);
      }

      // Deduplicate so Stripe retries don't double-notify
      try {
        await stripe.checkout.sessions.update(session.id, {
          metadata: { ...fullSession.metadata, instagramNotified: 'true' },
        });
      } catch (err) {
        console.error('Failed to set instagramNotified metadata:', err);
      }
    }

    // ── Custom Audio: notify Isis immediately, before any brief is submitted ──
    const hasCustomAudio = products.some((p) => p.id === 'custom_audio');
    if (hasCustomAudio) {
      try {
        await notifyCustomAudioPaymentReceived({
          name,
          email,
          sessionId: session.id,
          amount,
          currency,
        });
      } catch (err) {
        console.error('notifyCustomAudioPaymentReceived error:', err);
      }
    }

    // ── RTT™ Session bookings: notify Isis the moment payment clears ──
    const sessionProducts = products.filter((p) => p.isSession && p.id !== 'custom_audio' && !instagramAuditIds.has(p.id));
    const alreadyNotifiedSession = fullSession.metadata?.sessionWebhookNotified === 'true';

    if (sessionProducts.length && !alreadyNotifiedSession) {
      const productName = sessionProducts.length === 1
        ? sessionProducts[0].name
        : sessionProducts.map((p) => p.name).join(', ');

      try {
        await notifyRTTSessionBooked({
          name,
          email,
          sessionId: session.id,
          amount,
          currency,
          productName,
        });
      } catch (err) {
        console.error('notifyRTTSessionBooked error:', err);
      }

      try {
        await stripe.checkout.sessions.update(session.id, {
          metadata: { ...fullSession.metadata, sessionWebhookNotified: 'true' },
        });
      } catch (err) {
        console.error('Failed to set sessionWebhookNotified metadata:', err);
      }
    }

    // ── Audio library purchases / bundles: internal notification ──
    // (downloads.js already sends the customer's confirmation email + file links
    // when they land on success.html — this webhook adds the same internal
    // notification as a guaranteed fallback, deduped via Stripe metadata so
    // Isis isn't emailed twice for the same order.)
    const hasAudioProduct = products.some((p) => (!p.isSession && !p.isBundle || p.isBundle) && !instagramIds.has(p.id));
    const alreadyNotified = fullSession.metadata?.webhookNotified === 'true';

    if (hasAudioProduct && !hasCustomAudio && !alreadyNotified) {
      const audioNames = products.map((p) => p.name);
      const productName = products.length === 1 ? products[0].name : `${products.length} items`;

      try {
        await notifyAudioPurchaseReceived({ name, email, audioNames, productName, amount, currency });
      } catch (err) {
        console.error('notifyAudioPurchaseReceived error:', err);
      }

      try {
        await stripe.checkout.sessions.update(session.id, {
          metadata: { ...fullSession.metadata, webhookNotified: 'true' },
        });
      } catch (err) {
        console.error('Failed to set webhookNotified metadata:', err);
      }
    }

    console.log(`Webhook processed: ${session.id} | products: ${products.map(p => p.id).join(', ') || 'unknown'}`);
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook processing error:', err);
    // Still return 200 so Stripe doesn't endlessly retry on a processing bug —
    // the payment itself succeeded; only the notification logic failed.
    return res.status(200).json({ received: true, error: err.message });
  }
};
