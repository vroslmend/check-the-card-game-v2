import { ImageResponse } from "next/og";

export const alt = "Check! · online multiplayer card game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colours are the light theme tokens from globals.css, resolved to hex because
// Satori has no CSS variables: ground, surface, ink, ink-muted, hairline, accent.
const GROUND = "#F0ECE5";
const SURFACE = "#FDFCFB";
const CARD_BACK = "#E7E0D4";
const INK = "#2B2622";
const INK_MUTED = "#6B645B";
const HAIRLINE = "#CFC9BF";
const ACCENT = "#CD4137";

function Card({
  left,
  rotate,
  faceUp,
}: {
  left: number;
  rotate: number;
  faceUp?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: faceUp ? 34 : 0,
        width: 196,
        height: 274,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 18,
        borderRadius: 18,
        border: `2px solid ${HAIRLINE}`,
        background: faceUp ? SURFACE : CARD_BACK,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 18px 40px rgba(43, 38, 34, 0.18)",
      }}
    >
      {faceUp ? (
        // One column wrapper, not a fragment: Satori flattens fragments and
        // lays the three glyphs out in a row.
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 700,
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
              fontSize: 104,
              color: ACCENT,
              lineHeight: 1,
            }}
          >
            ♥
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              fontSize: 44,
              fontWeight: 700,
              color: ACCENT,
              lineHeight: 1,
            }}
          >
            A
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: 10,
            border: `2px solid ${HAIRLINE}`,
          }}
        />
      )}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: GROUND,
          color: INK,
          padding: "0 84px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 26,
            maxWidth: 560,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: INK_MUTED,
            }}
          >
            Multiplayer card game
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 132,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Check!
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              lineHeight: 1.35,
              color: INK_MUTED,
            }}
          >
            Lowest hand wins, and you only ever saw two of your own cards.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 8,
              fontSize: 22,
              color: INK_MUTED,
              borderTop: `2px solid ${HAIRLINE}`,
              paddingTop: 22,
            }}
          >
            check-the-game.vercel.app
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            width: 470,
            height: 330,
          }}
        >
          <Card left={0} rotate={-11} />
          <Card left={110} rotate={-4} />
          <Card left={220} rotate={4} />
          <Card left={300} rotate={12} faceUp />
        </div>
      </div>
    ),
    { ...size },
  );
}
