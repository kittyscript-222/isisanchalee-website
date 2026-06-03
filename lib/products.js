// lib/products.js

const PRODUCTS = {
  prosperity_consciousness: {
    id: 'prosperity_consciousness',
    name: 'Prosperity Consciousness',
    stripePriceId: 'price_1TZpa5C38S5O6HWPXQt6vTEv',
    files: [{ name: 'Prosperity Consciousness.mp3', driveFileId: '1FJ0T4taAphfORVFjzXaHWaTPmgavulHO' }],
  },
  magnetic_confidence: {
    id: 'magnetic_confidence',
    name: 'Magnetic Confidence',
    stripePriceId: 'price_1TZpZIC38S5O6HWPBQqLBp5b',
    files: [{ name: 'Magnetic Confidence.mp3', driveFileId: '1CfayELQB8NjELQFKApOA7u1zK9TF_rFi' }],
  },
  secure_attachment: {
    id: 'secure_attachment',
    name: 'Secure Attachment & Healthy Love',
    stripePriceId: 'price_1TZpYsC38S5O6HWP5rfXj2pI',
    files: [{ name: 'Secure Attachment & Healthy Love.mp3', driveFileId: '1xI7wu3jpUd7C-MMnd9oUV4Uksa33I70y' }],
  },
  inner_safety: {
    id: 'inner_safety',
    name: 'Inner Safety & Wholeness',
    stripePriceId: 'price_1TZpYJC38S5O6HWPG4tO3Ft5',
    files: [{ name: 'Inner Safety & Wholeness.mp3', driveFileId: '1vi2CkrZvlZHIJXDiG9Fc86bvJ_zFGK0b' }],
  },
  calling_in_union: {
    id: 'calling_in_union',
    name: 'Calling in Union',
    stripePriceId: 'price_1TZpXgC38S5O6HWPSJbLDnkB',
    files: [{ name: 'Calling in Union.mp3', driveFileId: '1FM5DjA_kPsfybhZ6An_wfP7vNWfWBVNB' }],
  },
  strengthening_intuition: {
    id: 'strengthening_intuition',
    name: 'Strengthening Intuition',
    stripePriceId: 'price_1TZpWuC38S5O6HWPeEd4JQxy',
    files: [{ name: 'Strengthening Intuition.mp3', driveFileId: '1R34WY_0N0hz2SRp773Bfh7-2EaNT1Qbh' }],
  },
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

  // ── Remaining audios — add price IDs + Drive IDs when ready ──────────────
  nervous_system_regulation: {
    id: 'nervous_system_regulation',
    name: 'Nervous System Regulation',
    stripePriceId: 'price_REPLACE_ME',
    files: [{ name: 'Nervous System Regulation.mp3', driveFileId: 'DRIVE_FILE_ID' }],
  },
  embody_highest_self: {
    id: 'embody_highest_self',
    name: 'Embody Your Highest Self',
    stripePriceId: 'price_REPLACE_ME',
    files: [{ name: 'Embody Your Highest Self.mp3', driveFileId: 'DRIVE_FILE_ID' }],
  },
  radiant_health: {
    id: 'radiant_health',
    name: 'Radiant Health & Vitality',
    stripePriceId: 'price_REPLACE_ME',
    files: [{ name: 'Radiant Health & Vitality.mp3', driveFileId: 'DRIVE_FILE_ID' }],
  },
  unshakeable_self_worth: {
    id: 'unshakeable_self_worth',
    name: 'Unshakeable Self-Worth',
    stripePriceId: 'price_REPLACE_ME',
    files: [{ name: 'Unshakeable Self-Worth.mp3', driveFileId: 'DRIVE_FILE_ID' }],
  },
  // ── Bundles ───────────────────────────────────────────────────────────────
  bundle_3: {
    id: 'bundle_3',
    name: 'Bundle of 3 Hypnosis Audios',
    stripePriceId: 'price_1TZrd1C38S5O6HWPoHLKHBFG',
    isBundle: true,
    files: [],
  },
  bundle_5: {
    id: 'bundle_5',
    name: 'Bundle of 5 Hypnosis Audios',
    stripePriceId: 'price_1TZreEC38S5O6HWPXHMSeNVX',
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
};

const AUDIO_BY_NAME = Object.fromEntries(
  Object.values(PRODUCTS)
    .filter(p => !p.isBundle)
    .map(p => [p.name, p])
);

module.exports = { PRODUCTS, AUDIO_BY_NAME };
