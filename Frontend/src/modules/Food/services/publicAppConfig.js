/**
 * Public app configuration shared by the user, restaurant and delivery apps:
 * admin feature flags and fee settings (donation presets), loaded once and cached for a few minutes.
 *
 * Ported from the legacy frontend, trimmed to the pieces the restored features need.
 */

import apiClient from "@food/api/axios";

export const PUBLIC_CONFIG_URLS = {
  FEATURE: "/food/admin/feature-settings/public",
  FEE: "/food/admin/fee-settings/public",
  TOP_BANNERS: "/food/top-banners/public",
  HOME_PROMOTION_BANNERS: "/food/hero-banners/home-promotion/public",
  OTHER_APPS: "/food/other-apps/public",
};

const CONFIG_TTL_MS = 5 * 60 * 1000;

const emptyStore = () => ({
  featureSettings: null,
  feeSettings: null,
  loadedAt: 0,
});

let store = emptyStore();
let corePromise = null;

const isFresh = () => store.loadedAt > 0 && Date.now() - store.loadedAt < CONFIG_TTL_MS;

export const getPublicAppConfigSnapshot = () => ({ ...store });

export const invalidatePublicAppConfig = () => {
  store = emptyStore();
  corePromise = null;
};

/** Feature flags + fee settings. Failures keep the previous (or empty) values so the apps still render. */
export const loadCorePublicAppConfig = async ({ force = false } = {}) => {
  if (!force && isFresh()) return getPublicAppConfigSnapshot();
  if (corePromise && !force) return corePromise;

  corePromise = (async () => {
    const [featureRes, feeRes] = await Promise.all([
      apiClient.get(PUBLIC_CONFIG_URLS.FEATURE).catch(() => null),
      apiClient.get(PUBLIC_CONFIG_URLS.FEE).catch(() => null),
    ]);

    const rows = featureRes?.data?.data;
    if (Array.isArray(rows)) store.featureSettings = rows;
    const fee = feeRes?.data?.data?.feeSettings;
    if (fee !== undefined) store.feeSettings = fee || null;
    store.loadedAt = Date.now();
    return getPublicAppConfigSnapshot();
  })();

  try {
    return await corePromise;
  } finally {
    corePromise = null;
  }
};

export const getCachedFeatureSettings = () => store.featureSettings;

export const getCachedFeeSettings = () => store.feeSettings;

export const getFeatureSettingByKey = (key, fallback = null) => {
  const feature = (store.featureSettings || []).find((row) => row.key === key);
  return feature || fallback;
};

export const isFeatureEnabled = (key, fallback = true) => {
  const feature = getFeatureSettingByKey(key, null);
  if (!feature) return fallback;
  const value = feature.isEnabled;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
};

const toOptionList = (values, max) =>
  [...new Set((Array.isArray(values) ? values : []).map((v) => Math.floor(Number(v))).filter((n) => Number.isFinite(n) && n > 0 && n <= max))].sort((a, b) => a - b)

/** Donation preset amounts the customer may pick from at checkout (empty when donations are off). */
export const getDonationOptions = (feeSettings = store.feeSettings) => {
  if (!feeSettings || feeSettings.donationEnabled !== true) return []
  return toOptionList(feeSettings.donationAmounts, 1000)
}

/** The donation preset that is pre-selected / charged by default. One is always selected once enabled. */
export const getDonationDefaultAmount = (feeSettings = store.feeSettings) => {
  const options = getDonationOptions(feeSettings)
  if (options.length === 0) return 0
  const def = Math.floor(Number(feeSettings?.donationDefaultAmount))
  return options.includes(def) ? def : options[0]
}

/** Delivery tip preset amounts the customer may pick from at checkout (empty when tips are off). */
export const getTipOptions = (feeSettings = store.feeSettings) => {
  if (!feeSettings || feeSettings.deliveryTipEnabled !== true) return []
  return toOptionList(feeSettings.deliveryTipAmounts, 500)
}

/** The tip preset that is pre-selected / charged by default. One is always selected once enabled. */
export const getTipDefaultAmount = (feeSettings = store.feeSettings) => {
  const options = getTipOptions(feeSettings)
  if (options.length === 0) return 0
  const def = Math.floor(Number(feeSettings?.deliveryTipDefaultAmount))
  return options.includes(def) ? def : options[0]
}
