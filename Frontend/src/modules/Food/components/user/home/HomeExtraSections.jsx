import { useEffect, useMemo, useState } from "react";
import api from "@food/api";
import AdBannersCarousel from "./AdBannersCarousel";
import PromotionBannerCarousel from "./PromotionBannerCarousel";
import OtherAppsSection from "./OtherAppsSection";

/**
 * Home sections restored from the legacy user app, driven by the admin panel:
 *  - top banners (admin uploaded) and paid self-serve banner ads
 *  - home promotion banners
 *  - "Other apps" download cards
 */
export default function HomeExtraSections() {
  const [topBanners, setTopBanners] = useState([]);
  const [ads, setAds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/food/top-banners/public")
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data || {};
        setTopBanners(Array.isArray(data.banners) ? data.banners : []);
        setAds(Array.isArray(data.ads) ? data.ads : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The carousel renders `image` and treats entries without a target as non-clickable.
  const topBannerSlides = useMemo(
    () => topBanners.map((banner) => ({ _id: banner._id, image: banner.image || banner.imageUrl })),
    [topBanners],
  );

  return (
    <>
      {topBannerSlides.length > 0 && <AdBannersCarousel ads={topBannerSlides} />}
      <PromotionBannerCarousel />
      {ads.length > 0 && <AdBannersCarousel ads={ads} />}
      <OtherAppsSection />
    </>
  );
}
