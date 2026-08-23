import { ImageResponse } from "next/og";

// The raster icon at purpose "any", alongside the SVG favicon. Installability
// checks look for a raster icon of at least 192 that is not maskable-only, and
// a maskable drawing cannot double as this one: it carries padding for a crop
// that will not happen here, so unmasked it reads as a small mark adrift in a
// large square.
export const dynamic = "force-static";

const GROUND = "#121212"; // --ground     0 0% 7%
const ACCENT = "#BA3F3B"; // --accent     2 52% 48%
const ACCENT_INK = "#FFF6F0"; // --accent-ink 23 100% 97%

const SIZE = 512;

export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: SIZE,
        height: SIZE,
        background: GROUND,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 280,
          height: 392,
          borderRadius: 48,
          background: ACCENT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(-6deg)",
        }}
      >
        <svg
          width={172}
          height={172}
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
    { width: SIZE, height: SIZE },
  );
}
