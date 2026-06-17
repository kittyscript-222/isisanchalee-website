// tests/products.test.js
// Tests for lib/products.js — the product catalog.
// Catches typos, duplicate Stripe Price IDs, and missing required fields
// before they cause a webhook or checkout to silently fail to match a product.

const test = require('node:test');
const assert = require('node:assert/strict');

function freshProductsModule() {
  delete require.cache[require.resolve('../lib/products.js')];
  return require('../lib/products.js');
}

test('products.js loads without throwing', () => {
  assert.doesNotThrow(() => freshProductsModule());
});

test('every product has an id, name, and stripePriceId', () => {
  const { PRODUCTS } = freshProductsModule();
  for (const [key, product] of Object.entries(PRODUCTS)) {
    assert.ok(product.id, `${key} is missing an id`);
    assert.ok(product.name, `${key} is missing a name`);
    assert.ok(product.stripePriceId, `${key} is missing a stripePriceId`);
    assert.match(product.stripePriceId, /^price_/, `${key}'s stripePriceId doesn't look like a real Stripe Price ID`);
  }
});

test('every product key matches its own id field', () => {
  const { PRODUCTS } = freshProductsModule();
  for (const [key, product] of Object.entries(PRODUCTS)) {
    assert.equal(key, product.id, `catalog key "${key}" doesn't match its id field "${product.id}"`);
  }
});

test('no two products share the same Stripe Price ID', () => {
  const { PRODUCTS } = freshProductsModule();
  const priceIds = Object.values(PRODUCTS).map((p) => p.stripePriceId);
  const seen = new Set();
  const duplicates = [];
  for (const id of priceIds) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  assert.equal(duplicates.length, 0, `Duplicate Stripe Price IDs found: ${duplicates.join(', ')}`);
});

test('custom_audio product exists and is flagged correctly (no pre-recorded files)', () => {
  const { PRODUCTS } = freshProductsModule();
  const customAudio = PRODUCTS.custom_audio;
  assert.ok(customAudio, 'custom_audio product is missing from the catalog');
  assert.equal(customAudio.isSession, true);
  assert.deepEqual(customAudio.files, []);
});

test('AUDIO_BY_NAME excludes bundles and includes individual audios', () => {
  const { PRODUCTS, AUDIO_BY_NAME } = freshProductsModule();
  for (const product of Object.values(PRODUCTS)) {
    if (product.isBundle) {
      assert.equal(AUDIO_BY_NAME[product.name], undefined, `${product.name} is a bundle and should not be in AUDIO_BY_NAME`);
    } else {
      assert.equal(AUDIO_BY_NAME[product.name]?.id, product.id, `${product.name} should be findable in AUDIO_BY_NAME`);
    }
  }
});

test('hypnosis audio products (non-session, non-bundle) each have at least one file', () => {
  const { PRODUCTS } = freshProductsModule();
  for (const [key, product] of Object.entries(PRODUCTS)) {
    if (!product.isSession && !product.isBundle) {
      assert.ok(
        Array.isArray(product.files) && product.files.length > 0,
        `${key} is a pre-recorded audio product but has no files attached`
      );
      for (const file of product.files) {
        assert.ok(file.name, `${key} has a file missing a name`);
        assert.ok(file.driveFileId, `${key}'s file "${file.name}" is missing a driveFileId`);
      }
    }
  }
});
