import { ImageResponse } from "next/og";

// iOS does not read the manifest for the home screen icon, it wants an
// apple-touch-icon, and it does not round or pad one either. So this is the
// mark on the app's own ground at the size Apple asks for, drawn from the same
// tokens as opengraph-image.tsx.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const GROUND = "#121212"; // --ground   0 0% 7%
const ACCENT = "#BA3F3B"; // --accent   2 52% 48%
const ACCENT_INK = "#FFF6F0"; // --accent-ink 23 100% 97%

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: size.width,
        height: size.height,
        background: GROUND,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 96,
          height: 134,
          borderRadius: 18,
          background: ACCENT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(-6deg)",
        }}
      >
        <svg
          width={60}
          height={60}
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT_INK}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
    </div>,
    size,
  );
}
