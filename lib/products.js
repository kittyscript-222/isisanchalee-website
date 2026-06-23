// lib/products.js

const PRODUCTS = {
  // ── HYPNOSIS AUDIOS ──────────────────────────────────────────────────────
  wired_for_miracles: {
    id: 'wired_for_miracles',
    name: 'Wired for Miracles',
    stripePriceId: 'price_1Titc1C38S5O6HWPgS5rEVYT',
    files: [{ name: 'Wired for Miracles.mp3', driveFileId: '1b4irmt6PF6iDFKaLf1cIfQOVX_v_q3oN' }],
  },
  prosperity_consciousness: {
    id: 'prosperity_consciousness',
    name: 'Prosperity Consciousness',
    stripePriceId: 'price_1ThW4PC38S5O6HWPUWVaT6uB',
    files: [{ name: 'Prosperity Consciousness.mp3', driveFileId: '1Lf70jaLlMYKDfauxJyJ1vc52MzFAEBET' }],
  },
  nervous_system_regulation: {
    id: 'nervous_system_regulation',
    name: 'Nervous System Regulation',
    stripePriceId: 'price_1TitYaC38S5O6HWPEVduUAKM',
    files: [{ name: 'Nervous System Regulation.mp3', driveFileId: '1AdAelwPHluh8RP18TcCdN4AH9lGwGm_T' }],
  },
  manifest_love: {
    id: 'manifest_love',
    name: 'Manifest Love',
    stripePriceId: 'price_1Titb6C38S5O6HWPP74R9P1Z',
    files: [{ name: 'Manifest Love.mp3', driveFileId: '1N2CGPFNRsTqwWK9AXwuSnCj8XPEmAdmK' }],
  },
  unwavering_self_confidence: {
    id: 'unwavering_self_confidence',
    name: 'Unwavering Self-Confidence',
    stripePriceId: 'price_1Tita9C38S5O6HWPfUtBJ5Cz',
    files: [{ name: 'Unwavering Self-Confidence.mp3', driveFileId: '1EaVtT0g-9Koag81xUgbHvkojraBCE218' }],
  },
  living_your_dream_life: {
    id: 'living_your_dream_life',
    name: 'Living Your Dream Life',
    stripePriceId: 'price_1TitZAC38S5O6HWPqsN6TAlX',
    files: [{ name: 'Living Your Dream Life.mp3', driveFileId: '1TIjVmQQS-Ri2TSZUqFrvZwPBsbFJgSmO' }],
  },
  // deep_sleep: removed from catalog — not ready yet, add back when recording is complete
  // {
  //   id: 'deep_sleep',
  //   name: 'Deep Sleep',
  //   stripePriceId: 'price_1TZpa5C38S5O6HWPXQt6vTEv',
  //   files: [{ name: 'Deep Sleep.mp3', driveFileId: '1BD7yVIabaxWq8JTuK_JpC_w1x5Niuui4' }],
  // },

  // ── 1:1 SESSIONS ─────────────────────────────────────────────────────────
  rtt_single_supported: {
    id: 'rtt_single_supported',
    name: 'Single RTT™ Session — Supported',
    stripePriceId: 'price_1TZsNSC38S5O6HWPZY3XTT0N', // $350
    isSession: true,
    files: [],
  },
  rtt_single_standard: {
    id: 'rtt_single_standard',
    name: 'Single RTT™ Session — Standard',
    stripePriceId: 'price_1TZsO1C38S5O6HWP0ixwGJf7', // $500
    isSession: true,
    files: [],
  },
  rtt_single_abundant: {
    id: 'rtt_single_abundant',
    name: 'Single RTT™ Session — Abundant',
    stripePriceId: 'price_1TZsP3C38S5O6HWPdG4zwj90', // $650
    isSession: true,
    files: [],
  },
  rtt_pack_3_supported: {
    id: 'rtt_pack_3_supported',
    name: 'RTT™ Pack of 3 — Supported',
    stripePriceId: 'price_1TZsPnC38S5O6HWPhVHlwdgn', // $1,000
    isSession: true,
    files: [],
  },
  rtt_pack_3_standard: {
    id: 'rtt_pack_3_standard',
    name: 'RTT™ Pack of 3 — Standard',
    stripePriceId: 'price_1TZsVHC38S5O6HWP5NVWcqnc', // $1,500
    isSession: true,
    files: [],
  },
  rtt_pack_3_abundant: {
    id: 'rtt_pack_3_abundant',
    name: 'RTT™ Pack of 3 — Abundant',
    stripePriceId: 'price_1TZsVxC38S5O6HWPyxqmsKlp', // $1,800
    isSession: true,
    files: [],
  },

  custom_audio: {
    id: 'custom_audio',
    name: 'Custom Hypnosis Audio',
    stripePriceId: 'price_1TbcM2C38S5O6HWPhQAa58iF',
    isSession: true,
    files: [],
  },

  // ── Bundles ───────────────────────────────────────────────────────────────
  bundle_3: {
    id: 'bundle_3',
    name: 'Bundle of 3 Hypnosis Audios',
    stripePriceId: 'price_1TitdfC38S5O6HWPIXmiqaln',
    isBundle: true,
    files: [],
  },
  bundle_5: {
    id: 'bundle_5',
    name: 'Bundle of 5 Hypnosis Audios',
    stripePriceId: 'price_1TiteIC38S5O6HWPJkqMkTm6',
    isBundle: true,
    files: [],
  },
  bundle_10: {
    id: 'bundle_10',
    name: 'Bundle of 10 Hypnosis Audios',
    stripePriceId: 'price_1TZrtMC38S5O6HWPApED2LzR',
    isBundle: true,
    files: [],
  },

  // ── INSTAGRAM GUIDE / AUDIO / AUDIT ──────────────────────────────────────
  instagram_guide: {
    id: 'instagram_guide',
    name: 'How to Master the Game of Instagram',
    stripePriceId: 'price_1TkiJmC38S5O6HWPNZHuHzJC', // $37
    files: [{ name: 'How to Master the Game of Instagram.pdf', driveFileId: '1p1c6itLaYe0jrpiZ0LuuDbXhGite-dbT' }],
  },
  instagram_guide_bundle: {
    id: 'instagram_guide_bundle',
    name: 'How to Master the Game of Instagram + Instagram Identity Shift Audio Bundle',
    stripePriceId: 'price_1TkiK7C38S5O6HWPG2fLMCD6', // $60
    files: [
      { name: 'How to Master the Game of Instagram.pdf', driveFileId: '1p1c6itLaYe0jrpiZ0LuuDbXhGite-dbT' },
      { name: 'Instagram Identity Shift.mp3', driveFileId: '1JNlZhCFS42QeD5Dqtz2wl9Ot0puV-48Q' },
    ],
  },
  magnetic_growth_audio: {
    id: 'magnetic_growth_audio',
    name: 'Instagram Identity Shift Hypnosis Audio',
    stripePriceId: 'price_1TkiLzC38S5O6HWPouVNCLAh', // $33
    files: [{ name: 'Instagram Identity Shift.mp3', driveFileId: '1JNlZhCFS42QeD5Dqtz2wl9Ot0puV-48Q' }],
  },
  instagram_guide_audit: {
    id: 'instagram_guide_audit',
    name: 'How to Master the Game of Instagram + 1:1 Audit',
    stripePriceId: 'price_1TkiLEC38S5O6HWPPrN7NNwO', // $500 — needs new Stripe price ID at $500
    isSession: true, // includes a scheduled 1:1 call, same pattern as RTT/custom_audio
    files: [{ name: 'How to Master the Game of Instagram.pdf', driveFileId: '1p1c6itLaYe0jrpiZ0LuuDbXhGite-dbT' }],
  },
  instagram_guide_audio_audit: {
    id: 'instagram_guide_audio_audit',
    name: 'How to Master the Game of Instagram + Audio + 1:1 Audit (Full Bundle)',
    stripePriceId: 'price_1Tl6oSC38S5O6HWPJ6Rjkzdz', // $495
    isSession: true,
    files: [
      { name: 'How to Master the Game of Instagram.pdf', driveFileId: '1p1c6itLaYe0jrpiZ0LuuDbXhGite-dbT' },
      { name: 'Instagram Identity Shift.mp3', driveFileId: '1JNlZhCFS42QeD5Dqtz2wl9Ot0puV-48Q' },
    ],
  },
  // instagram_audit_session was retired when session pricing changed to $495:
  // the standalone "Book the Strategy Session" button now routes to
  // instagram_guide_audio_audit (same price, includes guide + audio).
  // This entry is kept as a comment so future devs understand the history.
  // instagram_audit_session: { id: 'instagram_audit_session', ... }
};

const AUDIO_BY_NAME = Object.fromEntries(
  Object.values(PRODUCTS)
    .filter(p => !p.isBundle)
    .map(p => [p.name, p])
);

module.exports = { PRODUCTS, AUDIO_BY_NAME };
