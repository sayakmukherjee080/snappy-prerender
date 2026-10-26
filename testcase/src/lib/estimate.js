import {
  DEDICATED_VOLUME_MIN,
  OUTPUT_SHARE,
  PLANS,
  RESERVED_DISCOUNT,
  SCALE_VOLUME_MIN,
} from '../content/pricing.js';

/**
 * Estimates the monthly Developer and Scale cost for a token volume and billing period, and
 * returns the tier that fits the volume.
 * @param {number} volumeMillions
 * @param {boolean} reserved
 * @returns {{ developer: number, scale: number, recommendation: 'Developer' | 'Scale' | 'Dedicated' }}
 */
export function estimateMonthlyCost(volumeMillions, reserved) {
  const multiplier = reserved ? 1 - RESERVED_DISCOUNT : 1;
  const developerPlan = PLANS.find((plan) => plan.id === 'developer');
  const scalePlan = PLANS.find((plan) => plan.id === 'scale');
  const inputMillions = volumeMillions * (1 - OUTPUT_SHARE);
  const outputMillions = volumeMillions * OUTPUT_SHARE;

  const developer =
    (inputMillions * developerPlan.input + outputMillions * developerPlan.output) * multiplier;
  const scale =
    (scalePlan.platform + inputMillions * scalePlan.input + outputMillions * scalePlan.output) *
    multiplier;

  let recommendation = 'Developer';
  if (volumeMillions > DEDICATED_VOLUME_MIN) {
    recommendation = 'Dedicated';
  } else if (volumeMillions >= SCALE_VOLUME_MIN) {
    recommendation = 'Scale';
  }

  return { developer, scale, recommendation };
}
