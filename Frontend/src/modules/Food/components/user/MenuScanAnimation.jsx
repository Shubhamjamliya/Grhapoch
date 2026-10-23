import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RestaurantDetailSkeleton } from "@food/components/ui/loading-skeletons"

export default function MenuScanAnimation({ onComplete, duration = 3000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, duration - 400) // start fade out

    const doneTimer = setTimeout(() => {
      onComplete?.()
    }, duration)

    return () => {
      clearTimeout(hideTimer)
      clearTimeout(doneTimer)
    }
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] bg-white overflow-hidden"
        >
          <RestaurantDetailSkeleton />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
