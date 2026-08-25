import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

// Dark, resolved to hex because a manifest cannot read CSS variables. Same
// reasoning and same values as opengraph-image.tsx: dark is the app's default
// theme (providers.tsx sets defaultTheme="dark"), so the splash and the window
// chrome match what a visitor actually sees rather than the light palette.
const GROUND = "#121212"; // --ground 0 0% 7%

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Check! - The Card Game",
    short_name: "Check!",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: GROUND,
    theme_color: GROUND,
    orientation: "any",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-512", type: "image/png", sizes: "512x512", purpose: "any" },
      {
        src: "/maskable-icon",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
