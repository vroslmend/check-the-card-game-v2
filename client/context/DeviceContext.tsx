"use client";

import { createContext, useContext, ReactNode } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

interface DeviceContextType {
  /** Is the viewport narrow enough to require a mobile-style layout? (based on width) */
  useMobileLayout: boolean;
  /** Is the primary input method touch? (based on pointer capability) */
  isTouchDevice: boolean;
  /** Alias for useMobileLayout to maintain backward compatibility */
  isMobile: boolean;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: ReactNode }) {
  // Flag for VISUAL LAYOUT changes (e.g., stacking columns)
  const useMobileLayout = useMediaQuery("(max-width: 1023px)");

  // Flag for FUNCTIONAL changes (e.g., disabling smooth scroll, hover effects)
  const isTouchDevice = useMediaQuery("(pointer: coarse)");

  return (
    <DeviceContext.Provider
      value={{ useMobileLayout, isTouchDevice, isMobile: useMobileLayout }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error("useDevice must be used within a DeviceProvider");
  }
  return context;
}
