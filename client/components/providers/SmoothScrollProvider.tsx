"use client"

import { ReactLenis, type LenisRef } from "lenis/react"
import { cancelFrame, frame, type FrameData } from "framer-motion"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null)

  useEffect(() => {
    function update(data: FrameData) {
      lenisRef.current?.lenis?.raf(data.timestamp)
    }

    frame.update(update, true)

    return () => {
      cancelFrame(update)
    }
  }, [])

  return (
    <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
      {children}
    </ReactLenis>
  )
} 