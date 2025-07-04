"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import { cancelFrame, frame, type FrameData } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useDevice } from "@/context/DeviceContext";

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const { isMobile } = useDevice();
  // Debug: log device type determination
  console.log("SmoothScrollProvider - isMobile:", isMobile);
  const lenisRef = useRef<LenisRef>(null);

  // Track client-side mounting to prevent SSR hydration mismatch
  const [isClient, setIsClient] = useState(false);

  // Flag the component as client-side after first mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialise Lenis only when running on the client AND device is not mobile
  useEffect(() => {
    if (!isClient || isMobile) return;

    function update(data: FrameData) {
      lenisRef.current?.lenis?.raf(data.timestamp);
    }

    frame.update(update, true);

    return () => {
      cancelFrame(update);
    };
  }, [isClient, isMobile]);

  // On the server or on mobile, fall back to native scroll.
  if (!isClient || isMobile) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}
