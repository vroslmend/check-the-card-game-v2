"use client"

import { ReactLenis, type LenisRef } from "lenis/react"
import { cancelFrame, frame, type FrameData } from "framer-motion"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null)
  // The game view is h-screen overflow-hidden — nothing scrolls, but Lenis'
  // per-frame raf (frame.update with keepAlive) still ran on the shared
  // framer-motion loop under every flight. Smooth scroll is landing-page
  // furniture; skip it entirely on game routes.
  const pathname = usePathname()
  const smoothScrollActive = !pathname.startsWith("/game")

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