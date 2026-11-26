export const MAX_TIP_AMOUNT = 500;
export const MAX_TIP_OPTIONS = 10;

/** Cleans a list of preset amounts: whole rupees, 1..MAX, unique, ascending, limited count. */
export function normalizeTipAmounts(values) {
  if (!Array.isArray(values)) return [];
  const set = new Set();
  for (const v of values) {
    const n = Math.floor(Number(v));
    if (Number.isFinite(n) && n > 0 && n <= MAX_TIP_AMOUNT) set.add(n);
  }
  return [...set].sort((a, b) => a - b).slice(0, MAX_TIP_OPTIONS);
}

/** Preset amounts customers can choose from. Empty when delivery tips are disabled. */
export function getTipOptions(feeSettings = {}) {
  if (feeSettings?.deliveryTipEnabled !== true) return [];
  return normalizeTipAmounts(feeSettings.deliveryTipAmounts);
}

/** The preset that is pre-selected / charged when the customer doesn't pick another valid one. */
export function getTipDefaultAmount(feeSettings = {}, options = getTipOptions(feeSettings)) {
  if (options.length === 0) return 0;
  const def = Math.floor(Number(feeSettings?.deliveryTipDefaultAmount));
  return options.includes(def) ? def : options[0];
}

/**
 * Delivery tip is optional: the customer may pick an admin preset or enter their own amount
 * (whole rupees, 1..MAX_TIP_AMOUNT). No choice (0) or an invalid amount means no tip.
 * 100% of the amount passes to the rider.
 */
export function resolveTipAmount(feeSettings = {}, requested) {
  const options = getTipOptions(feeSettings);
  if (options.length === 0) return 0;
  const n = Math.floor(Number(requested));
  if (Number.isFinite(n) && n > 0 && n <= MAX_TIP_AMOUNT) return n;
  return 0;
}
