import { ImageResponse } from "next/og";

export const alt = "Check! · online multiplayer card game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f0f12",
          color: "#f1ece4",
          padding: "72px 80px",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#8a8378",
            fontFamily: "sans-serif",
          }}
        >
          multiplayer card game
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              fontSize: 120,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            Check!
          </div>
          <div style={{ fontSize: 30, color: "#bcb4a6", maxWidth: 900, display: "flex" }}>
            Play online with friends, in real time.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #2a2823",
            paddingTop: 28,
            fontSize: 20,
            color: "#8a8378",
            fontFamily: "sans-serif",
          }}
        >
          <div>Next.js · Node.js · Socket.IO · XState</div>
          <div>check-the-game.vercel.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
