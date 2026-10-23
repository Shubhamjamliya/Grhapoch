import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Smartphone } from "lucide-react";
import api from "@food/api";

export default function OtherAppsSection() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        setLoading(true);
        const res = await api.get("/food/other-apps/public");
        if (res.data.success) {
          setApps(res.data.data.items || []);
        }
      } catch (err) {
        // Silently handle public fetch errors
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  if (loading || !apps || apps.length === 0) {
    return null;
  }

  const handleAppClick = (app) => {
    setSelectedApp(app);
  };

  const handleOpenLink = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="w-full max-w-[500px] mx-auto px-3 my-4">
      {/* Red Bordered Card Container matching screenshot design */}
      <div className="border border-rose-400 dark:border-rose-600/60 rounded-2xl p-3.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[14px] font-black text-gray-900 dark:text-gray-100 tracking-tight">
              Other Apps
            </h2>
          </div>
          {apps.length > 5 && (
            <span className="text-[11px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer flex items-center gap-0.5">
              View All <span className="text-xs">&rarr;</span>
            </span>
          )}
        </div>

        {/* Single Line Horizontal Scrollable App List */}
        <div className="flex items-start gap-3 overflow-x-auto scrollbar-none pb-1 pt-0.5 no-scrollbar scroll-smooth">
          {apps.map((app, idx) => (
            <motion.div
              key={app._id || idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAppClick(app)}
              className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer w-[72px] sm:w-[80px] text-center"
            >
              {/* App Icon Container */}
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/80 p-1 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all overflow-hidden">
                <img
                  src={app.iconUrl || app.imageUrl}
                  alt={app.title}
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>

              {/* Title & Subtitle */}
              <div className="flex flex-col items-center text-center w-full leading-none">
                <span className="text-[11px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight truncate max-w-full">
                  {app.title}
                </span>
                {app.subtitle && (
                  <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-400 capitalize truncate max-w-full mt-0.5">
                    {app.subtitle}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Interactive Download Popup Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden text-center"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedApp(null)}
                className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* App Large Icon */}
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700/80 p-2.5 shadow-md flex items-center justify-center overflow-hidden mb-3">
                <img
                  src={selectedApp.iconUrl || selectedApp.imageUrl}
                  alt={selectedApp.title}
                  className="w-full h-full object-contain rounded-2xl"
                />
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                {selectedApp.title}
              </h3>
              {selectedApp.subtitle && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                  {selectedApp.subtitle}
                </p>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-6">
                Get the official application on your device store:
              </p>

              {/* Redirection Store Buttons */}
              <div className="space-y-3">
                {selectedApp.playStoreLink && (
                  <button
                    onClick={() => handleOpenLink(selectedApp.playStoreLink)}
                    className="w-full py-3.5 px-4 bg-[#01875F] hover:bg-[#017351] text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-md shadow-[#01875F]/25 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {/* Google Play Store SVG Icon */}
                    <svg className="w-5 h-5 fill-white flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a1.238 1.238 0 0 1-.36-.887V2.7a1.237 1.237 0 0 1 .359-.886zm11.31 11.313l2.84 2.84-12.01 6.94 9.17-9.78zm0-2.254L5.75 1.093l12.01 6.94-2.84 2.84zm1.414 1.127l3.663 2.115a1.2 1.2 0 0 1 0 2.076l-3.663 2.115-2.587-2.587 2.587-2.519z" />
                    </svg>
                    <span className="text-white font-black text-sm tracking-wide">Download on Play Store</span>
                    <ExternalLink className="w-4 h-4 ml-auto text-white opacity-80 flex-shrink-0" />
                  </button>
                )}

                {selectedApp.appStoreLink && (
                  <button
                    onClick={() => handleOpenLink(selectedApp.appStoreLink)}
                    className="w-full py-3.5 px-4 bg-[#007AFF] hover:bg-[#0066D6] text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-md shadow-[#007AFF]/25 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {/* Apple App Store SVG Icon */}
                    <svg className="w-5 h-5 fill-white flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.13-1.96.99-3.11-.97.04-2.18.66-2.87 1.46-.61.71-1.15 1.87-.99 3.01 1.09.08 2.22-.53 2.87-1.36z" />
                    </svg>
                    <span className="text-white font-black text-sm tracking-wide">Download on App Store</span>
                    <ExternalLink className="w-4 h-4 ml-auto text-white opacity-80 flex-shrink-0" />
                  </button>
                )}

                {!selectedApp.playStoreLink && !selectedApp.appStoreLink && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl text-xs text-gray-500 dark:text-gray-400">
                    Store links coming soon!
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
