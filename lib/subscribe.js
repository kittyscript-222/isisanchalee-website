// api/subscribe.js
// POST /api/subscribe
// Body: { email: "user@example.com", firstName?: "Name" }
// Kit v4 API: create subscriber first, then add to form

const { logFreeAudioLead } = require('../lib/sheets');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, firstName } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // Log immediately after validation — before any downstream calls that could
  // crash. This guarantees the email is always visible in Vercel logs even if
  // sheets.js, Kit, or anything else throws later.
  console.log('subscribe attempt:', email, firstName || '(no name)');

  const headers = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': process.env.KIT_API_KEY,
  };

  try {
    // Step 1: Create or update subscriber
    const createRes = await fetch('https://api.kit.com/v4/subscribers', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email_address: email,
        ...(firstName && { first_name: firstName }),
      }),
    });

    const createData = await createRes.json();

    if (!createRes.ok && createRes.status !== 409) {
      console.error('Kit create subscriber error:', createData);
      return res.status(500).json({ error: 'Failed to create subscriber' });
    }

    // Get subscriber ID (from new creation or existing)
    const subscriberId = createData?.subscriber?.id;

    // Step 2: Add subscriber to form
    if (subscriberId && process.env.KIT_FORM_ID) {
      const formRes = await fetch(
        `https://api.kit.com/v4/forms/${process.env.KIT_FORM_ID}/subscribers/${subscriberId}`,
        { method: 'POST', headers }
      );
      if (!formRes.ok) {
        console.error('Kit add to form error:', await formRes.text());
      }
    }

    // Step 3: Subscribe to Substack (non-blocking — never fails the main response)
    if (process.env.SUBSTACK_URL) {
      const substackEndpoint = `${process.env.SUBSTACK_URL}/api/v1/free?email=${encodeURIComponent(email)}&utm_source=website`;
      fetch(substackEndpoint, { method: 'GET' }).catch((err) => {
        console.error('Substack subscribe error:', err);
      });
    }

    // Step 4: Log to Google Sheet
    // Awaited (not fire-and-forget) — in serverless environments, the function's
    // execution context can be torn down the instant the response is sent,
    // which kills any in-flight background promises before they get a chance
    // to actually make their network call. Awaiting guarantees this completes
    // (or fails loudly) before we respond.
    try {
      await logFreeAudioLead({ name: firstName, email });
    } catch (err) {
      console.error('Google Sheets log error:', err);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
