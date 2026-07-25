import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTruthfulness } from '../tailoring/validator.js';

test('Validator flags unverified claim metrics', () => {
  const fakeTailoredText = `- Developed features with 99.999% fake metric SLA.`;
  const result = validateTruthfulness(fakeTailoredText);

  assert.equal(result.isValid, false);
  assert.ok(result.unverifiedClaims.length > 0);
});

test('Validator approves ground truth resume claims', () => {
  const realTailoredText = `- Optimized Jetpack Compose recomposition patterns reducing rebuilds by ~25%.`;
  const result = validateTruthfulness(realTailoredText);

  assert.equal(result.isValid, true);
  assert.equal(result.unverifiedClaims.length, 0);
});
