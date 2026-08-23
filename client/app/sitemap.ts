import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The landing page and the rules are the only public routes. /game/<code> is
// a live room rather than a page, and robots.ts tells crawlers to skip it.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/rules`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
