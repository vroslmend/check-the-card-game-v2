"use client"

import { ReactLenis, type LenisRef } from "lenis/react"
import { cancelFrame, frame, type FrameData } from "framer-motion"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useDevice } from "@/context/DeviceContext"

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null)
  // The game view is h-screen overflow-hidden — nothing scrolls. And on
  // touch devices Lenis's wheel smoothing does nothing while its listeners
  // and scroll-linked springs are pure risk — phones get native scroll.
  const pathname = usePathname()
  const { isTouchDevice } = useDevice()
  const smoothScrollActive = !pathname.startsWith("/game") && !isTouchDevice

  useEffect(() => {
    if (!smoothScrollActive) return
    function update(data: FrameData) {
      lenisRef.current?.lenis?.raf(data.timestamp)
    }

    frame.update(update, true)

    return () => {
      cancelFrame(update)
    }
  }, [smoothScrollActive])

  if (!smoothScrollActive) {
    return <>{children}</>
  }

  return (
    <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
      {children}
    </ReactLenis>
  )
}
