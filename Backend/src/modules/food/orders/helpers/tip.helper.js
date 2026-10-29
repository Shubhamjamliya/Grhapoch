export const MAX_TIP_AMOUNT = 500;

/**
 * Delivery tip is a fixed, mandatory charge set by admin — not a customer choice.
 * Returns 0 when disabled.
 */
export function resolveTipAmount(feeSettings = {}) {
  if (feeSettings?.deliveryTipEnabled !== true) return 0;
  const n = Math.floor(Number(feeSettings.deliveryTipAmount));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_TIP_AMOUNT);
}
