import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Check! · online multiplayer card game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The app's dark theme tokens from globals.css, resolved to hex because Satori
// has no CSS variables. Dark is the app's default theme, so the card matches
// what a visitor actually sees.
const GROUND = "#121212"; // --ground   0 0% 7%
const SURFACE = "#242424"; // --surface  0 0% 14%
const INK = "#F1EEE9"; // --ink      38 22% 93%
const INK_MUTED = "#97928C"; // --ink-muted 36 5% 57%
const HAIRLINE = "#3B3B3B"; // --hairline 0 0% 23%
const ACCENT = "#BA3F3B"; // --accent   2 52% 48%
const ACCENT_INK = "#FFF6F0"; // --accent-ink 23 100% 97%

/** Drawn rather than typed. Satori has no fallback for a glyph missing from
 *  the fonts we supply, and Nunito Sans has no heart. */
function Heart({ size: s, color }: { size: number; color: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={color}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

/** The same mark the app uses: lucide's Check, the game's only icon. */
function CheckMark({ size: s, color }: { size: number; color: string }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** A table card: 5:7, accent back carrying the mark, surface face. */
function Card({
  left,
  top,
  rotate,
  width,
  faceUp,
}: {
  left: number;
  top: number;
  rotate: number;
  width: number;
  faceUp?: boolean;
}) {
  const height = Math.round((width * 7) / 5);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.round(width * 0.1),
        background: faceUp ? SURFACE : ACCENT,
        border: faceUp ? `2px solid ${HAIRLINE}` : "none",
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 26px 50px rgba(0, 0, 0, 0.55)",
      }}
    >
      {faceUp ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 46,
              fontWeight: 800,
              color: ACCENT,
              lineHeight: 1,
            }}
          >
            A
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Heart size={96} color={ACCENT} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              fontSize: 46,
              fontWeight: 800,
              color: ACCENT,
              lineHeight: 1,
            }}
          >
            A
          </div>
        </div>
      ) : (
        <CheckMark size={Math.round(width * 0.22)} color={ACCENT_INK} />
      )}
    </div>
  );
}

export default async function OpengraphImage() {
  // Nunito Sans is the app's one type family. Satori cannot read next/font, so
  // the files are committed and read from disk at build time. No network.
  const [regular, extraBold] = await Promise.all([
    readFile(join(process.cwd(), "app/fonts/NunitoSans-Regular.ttf")),
    readFile(join(process.cwd(), "app/fonts/NunitoSans-ExtraBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: GROUND,
          color: INK,
          padding: "0 84px",
          fontFamily: "Nunito Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 600,
          }}
        >
          {/* The brand mark, exactly as the app draws it: an accent card back
              tilted like one just placed on the table. */}
          <div
            style={{
              display: "flex",
              width: 54,
              height: 76,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              background: ACCENT,
              transform: "rotate(-6deg)",
              marginBottom: 34,
            }}
          >
            <CheckMark size={22} color={ACCENT_INK} />
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 138,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
            }}
          >
            Check!
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 32,
              lineHeight: 1.35,
              color: INK_MUTED,
              maxWidth: 570,
            }}
          >
            You only ever saw two of your cards. Lowest hand wins.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 38,
              fontSize: 21,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: INK_MUTED,
            }}
          >
            check-the-game.vercel.app
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            width: 430,
            height: 470,
          }}
        >
          <Card left={-30} top={104} rotate={-16} width={180} />
          <Card left={78} top={48} rotate={-7} width={180} />
          <Card left={190} top={34} rotate={2} width={180} />
          <Card left={292} top={96} rotate={14} width={180} faceUp />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Nunito Sans", data: regular, weight: 400, style: "normal" },
        { name: "Nunito Sans", data: extraBold, weight: 800, style: "normal" },
      ],
    },
  );
}
