import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// A lobby code is five characters and /game/<code> renders for anyone who
// opens it, so an indexed room URL is a stranger walking into a live game.
// Rooms are short lived, which is why this is a crawler instruction rather
// than an access control; guessing codes outright is tracked in #130.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/game/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
