const dollarFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Formats a whole-dollar amount with a leading dollar sign.
 * @param {number} value
 * @returns {string}
 */
export function formatDollars(value) {
  return `$${dollarFormat.format(Math.round(value))}`;
}

/**
 * Formats a number with grouped thousands.
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}
