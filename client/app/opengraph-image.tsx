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
  const rankSize = Math.round(width * 0.27);
  const pipSize = Math.round(width * 0.38);
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
              fontSize: rankSize,
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
            <Heart size={pipSize} color={ACCENT} />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              fontSize: rankSize,
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
            width: 560,
          }}
        >
          {/* Mark and wordmark on one line, the way the app's header sets it:
              an accent card back tilted like one just placed on the table,
              sized to the cap height of the type beside it. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 68,
                height: 95,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                background: ACCENT,
                transform: "rotate(-6deg)",
              }}
            >
              <CheckMark size={30} color={ACCENT_INK} />
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 132,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
              }}
            >
              Check!
            </div>
          </div>

          {/* Set as two explicit lines rather than left to wrap. The break
              belongs at the sentence, and a column this width would otherwise
              break it after "your". */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 26,
              fontSize: 30,
              lineHeight: 1.32,
              color: INK_MUTED,
            }}
          >
            <div style={{ display: "flex" }}>
              You only ever saw two of your cards.
            </div>
            <div style={{ display: "flex" }}>Lowest hand wins.</div>
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

        {/* A held fan: evenly spaced, rotations symmetric about the middle,
            outer cards dipping so the arc peaks in the centre. The container
            is sized to what it holds, a 235 tall card plus 44 of dip and the
            swing the rotation adds, so the parent's align-items centre
            centres the cards against the type rather than against empty
            space. Widths are set so the two columns and the padding total
            less than 1200, or the frame squeezes them. */}
        <div
          style={{
            position: "relative",
            display: "flex",
            width: 460,
            height: 320,
          }}
        >
          <Card left={0} top={44} rotate={-17} width={166} />
          <Card left={96} top={12} rotate={-6} width={166} />
          <Card left={192} top={12} rotate={6} width={166} />
          <Card left={288} top={44} rotate={17} width={166} faceUp />
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
