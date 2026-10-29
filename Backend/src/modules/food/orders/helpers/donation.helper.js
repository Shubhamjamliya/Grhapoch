export const MAX_DONATION_AMOUNT = 1000;

/**
 * Donation is a fixed, mandatory charge set by admin — not a customer choice.
 * Returns 0 when disabled.
 */
export function resolveDonationAmount(feeSettings = {}) {
  if (feeSettings?.donationEnabled !== true) return 0;
  const n = Math.floor(Number(feeSettings.donationAmount));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_DONATION_AMOUNT);
}
