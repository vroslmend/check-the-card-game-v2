"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import { cancelFrame, frame, type FrameData } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useDevice } from "@/context/DeviceContext";

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const { isMobile } = useDevice();
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    if (isMobile) return;

    function update(data: FrameData) {
      lenisRef.current?.lenis?.raf(data.timestamp);
    }

    frame.update(update, true);

    return () => {
      cancelFrame(update);
    };
  }, [isMobile]);

  // Use native scroll on mobile by skipping ReactLenis entirely.
  if (isMobile) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}
