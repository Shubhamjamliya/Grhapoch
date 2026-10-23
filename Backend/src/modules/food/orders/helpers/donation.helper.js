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

/**
 * Preset amounts customers can choose from. Empty when donations are disabled.
 * Falls back to the legacy single `donationAmount` for settings saved before presets existed.
 */
export function getDonationOptions(feeSettings = {}) {
  if (feeSettings?.donationEnabled !== true) return [];
  const list = normalizeDonationAmounts(feeSettings.donationAmounts);
  if (list.length > 0) return list;
  return normalizeDonationAmounts([feeSettings.donationAmount]);
}

/**
 * Donation is opt-in per order. The client sends the amount it picked; it is only
 * honoured when it is one of the admin-configured presets, otherwise 0.
 */
export function resolveDonationAmount(feeSettings = {}, requested = 0) {
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return getDonationOptions(feeSettings).includes(n) ? n : 0;
}
