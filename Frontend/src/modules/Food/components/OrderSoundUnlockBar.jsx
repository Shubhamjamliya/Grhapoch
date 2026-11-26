import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Volume2 } from "lucide-react"
import { toast } from "sonner"

// Browsers (and app WebViews) block sound until the user touches the page once after it
// loads. Restaurant/delivery staff need the new-order ring, so ask for that one tap up
// front. Any tap on the page unlocks sound (the notification hooks listen for it); this
// bar just makes the tap obvious and confirms it.

const isPanelPath = (pathname) =>
  /\/(restaurant|delivery)(\/|$)/.test(pathname) &&
  !/\/(auth|login|signup|otp|register|onboarding)(\/|$)/i.test(pathname)

const hasUserGesture = () =>
  typeof navigator !== "undefined" && Boolean(navigator.userActivation?.hasBeenActive)

export default function OrderSoundUnlockBar() {
  const location = useLocation()
  const [unlocked, setUnlocked] = useState(hasUserGesture)

  useEffect(() => {
    if (unlocked) return undefined
    const markUnlocked = () => setUnlocked(true)
    window.addEventListener("pointerdown", markUnlocked, { once: true, passive: true })
    window.addEventListener("keydown", markUnlocked, { once: true })
    return () => {
      window.removeEventListener("pointerdown", markUnlocked)
      window.removeEventListener("keydown", markUnlocked)
    }
  }, [unlocked])

  if (unlocked || !isPanelPath(location.pathname)) return null

  return (
    <button
      type="button"
      onClick={() => {
        setUnlocked(true)
        toast.success("Order sound enabled")
      }}
      className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-[#EB590E] px-4 py-3 text-sm font-semibold text-white shadow-md active:opacity-90"
    >
      <Volume2 className="h-4 w-4 shrink-0" />
      Tap here to enable new-order sound
    </button>
  )
}
