export const MAX_DONATION_AMOUNT = 1000;
export const MAX_DONATION_OPTIONS = 10;

/** Cleans a list of preset amounts: whole rupees, 1..MAX, unique, ascending, limited count. */
export function normalizeDonationAmounts(values) {
  if (!Array.isArray(values)) return [];
  const set = new Set();
  for (const v of values) {
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n > 0 && n <= MAX_DONATION_AMOUNT) set.add(n);
  }
  return [...set].sort((a, b) => a - b).slice(0, MAX_DONATION_OPTIONS);
}

/** Preset amounts customers can choose from. Empty when donations are disabled. */
export function getDonationOptions(feeSettings = {}) {
  if (feeSettings?.donationEnabled !== true) return [];
  return normalizeDonationAmounts(feeSettings.donationAmounts);
}

/** The preset that is pre-selected / charged when the customer doesn't pick another valid one. */
export function getDonationDefaultAmount(feeSettings = {}, options = getDonationOptions(feeSettings)) {
  if (options.length === 0) return 0;
  const def = Math.floor(Number(feeSettings?.donationDefaultAmount));
  return options.includes(def) ? def : options[0];
}

/**
 * Donation is optional: the customer may pick an admin preset or enter their own amount
 * (whole rupees, 1..MAX_DONATION_AMOUNT). No choice (0) or an invalid amount means no donation.
 */
export function resolveDonationAmount(feeSettings = {}, requested) {
  const options = getDonationOptions(feeSettings);
  if (options.length === 0) return 0;
  const n = Math.floor(Number(requested));
  if (Number.isFinite(n) && n > 0 && n <= MAX_DONATION_AMOUNT) return n;
  return 0;
}
