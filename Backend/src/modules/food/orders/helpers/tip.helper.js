export const MAX_TIP_AMOUNT = 500;

/**
 * Normalizes a customer-supplied tip: whole rupees, clamped to [0, MAX_TIP_AMOUNT].
 * Anything non-numeric, negative or non-finite becomes 0.
 */
export function normalizeTipAmount(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_TIP_AMOUNT);
}
