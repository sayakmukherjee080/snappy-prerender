import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEDICATED_VOLUME_MIN,
  OUTPUT_SHARE,
  PLANS,
  RESERVED_DISCOUNT,
  SCALE_VOLUME_MIN,
} from '../src/content/pricing.js';
import { estimateMonthlyCost } from '../src/lib/estimate.js';

/**
 * Recomputes the expected metered cost independently of the implementation.
 * @param {number} volumeMillions
 * @param {boolean} reserved
 * @returns {{ developer: number, scale: number }}
 */
function expectedCosts(volumeMillions, reserved) {
  const multiplier = reserved ? 1 - RESERVED_DISCOUNT : 1;
  const developer = PLANS.find((plan) => plan.id === 'developer');
  const scale = PLANS.find((plan) => plan.id === 'scale');
  const input = volumeMillions * (1 - OUTPUT_SHARE);
  const output = volumeMillions * OUTPUT_SHARE;

  return {
    developer: (input * developer.input + output * developer.output) * multiplier,
    scale: (scale.platform + input * scale.input + output * scale.output) * multiplier,
  };
}

test('on-demand estimates match metered plan rates', () => {
  const result = estimateMonthlyCost(50, false);
  const expected = expectedCosts(50, false);

  assert.ok(Math.abs(result.developer - expected.developer) < 1e-9);
  assert.ok(Math.abs(result.scale - expected.scale) < 1e-9);
});

test('reserved estimates apply the annual discount to usage and platform fee', () => {
  const onDemand = estimateMonthlyCost(80, false);
  const reserved = estimateMonthlyCost(80, true);

  assert.ok(Math.abs(reserved.developer - onDemand.developer * (1 - RESERVED_DISCOUNT)) < 1e-9);
  assert.ok(Math.abs(reserved.scale - onDemand.scale * (1 - RESERVED_DISCOUNT)) < 1e-9);
});

test('recommendation switches at the documented volume boundaries', () => {
  assert.equal(estimateMonthlyCost(SCALE_VOLUME_MIN - 1, false).recommendation, 'Developer');
  assert.equal(estimateMonthlyCost(SCALE_VOLUME_MIN, false).recommendation, 'Scale');
  assert.equal(estimateMonthlyCost(DEDICATED_VOLUME_MIN, false).recommendation, 'Scale');
  assert.equal(estimateMonthlyCost(DEDICATED_VOLUME_MIN + 1, false).recommendation, 'Dedicated');
});
