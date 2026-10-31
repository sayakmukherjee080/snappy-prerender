import { useId, useState } from 'react';
import { MAX_VOLUME, MIN_VOLUME } from '../../content/pricing.js';
import { estimateMonthlyCost } from '../../lib/estimate.js';
import { formatDollars } from '../../lib/format.js';

/**
 * Renders the token-volume estimator. It can be controlled by a parent billing toggle or manage
 * its own on the standalone estimator page.
 * @param {{ reserved?: boolean, onReservedChange?: (reserved: boolean) => void, showToggle?: boolean }} props
 */
export function PricingCalculator({
  reserved: controlledReserved,
  onReservedChange,
  showToggle = true,
}) {
  const [internalReserved, setInternalReserved] = useState(false);
  const [volume, setVolume] = useState(50);
  const generatedId = useId();
  const sliderId = `token-volume-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const isControlled = controlledReserved !== undefined;
  const reserved = isControlled ? controlledReserved : internalReserved;
  const { developer, scale, recommendation } = estimateMonthlyCost(volume, reserved);

  /**
   * Updates the billing period through the controlled or internal path.
   * @param {boolean} next
   */
  function setReserved(next) {
    if (!isControlled) setInternalReserved(next);
    onReservedChange?.(next);
  }

  return (
    <div className="calculator">
      <div className="calculator__controls">
        {showToggle && (
          <fieldset className="pricing-toggle calculator__toggle" aria-label="Billing period">
            <button type="button" aria-pressed={!reserved} onClick={() => setReserved(false)}>
              On-demand
            </button>
            <button type="button" aria-pressed={reserved} onClick={() => setReserved(true)}>
              Reserved · save 20%
            </button>
          </fieldset>
        )}

        <label className="mono-label" htmlFor={sliderId}>
          Monthly tokens
        </label>
        <div className="calculator__value">
          {volume}
          <span>M</span>
        </div>
        <input
          id={sliderId}
          type="range"
          min={MIN_VOLUME}
          max={MAX_VOLUME}
          step="1"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
        <div className="calculator__scale">
          <span>{MIN_VOLUME}M</span>
          <span>{MAX_VOLUME}M</span>
        </div>
        <p className="calculator__assumption">
          {reserved ? 'Reserved rates applied.' : 'On-demand rates applied.'} Input and output are
          metered separately; the estimator uses a 70/30 mix.
        </p>
      </div>

      <div className="calculator__output">
        <p className="mono-label">Estimated monthly</p>
        <div className="calculator__row">
          <span>Developer</span>
          <strong>{formatDollars(developer)}</strong>
        </div>
        <div className="calculator__row">
          <span>Scale</span>
          <strong>{formatDollars(scale)}</strong>
        </div>
        <div className="calculator__row">
          <span>Dedicated</span>
          <strong>Custom</strong>
        </div>
        <p className="calculator__recommendation">
          Best fit <strong>{recommendation}</strong>
        </p>
        <p className="calculator__note">
          Estimates exclude taxes. A dedicated node starts at $180,000 per month.
        </p>
      </div>
    </div>
  );
}
