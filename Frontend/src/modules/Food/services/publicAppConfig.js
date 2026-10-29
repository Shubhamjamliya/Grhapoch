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

/** Fixed, mandatory donation amount set by admin (0 when donations are off). */
export const getDonationAmount = (feeSettings = store.feeSettings) => {
  if (!feeSettings || feeSettings.donationEnabled !== true) return 0;
  const n = Math.floor(Number(feeSettings.donationAmount));
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : 0;
};

/** Fixed, mandatory delivery tip amount set by admin (0 when tips are off). */
export const getDeliveryTipAmount = (feeSettings = store.feeSettings) => {
  if (!feeSettings || feeSettings.deliveryTipEnabled !== true) return 0;
  const n = Math.floor(Number(feeSettings.deliveryTipAmount));
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : 0;
};
