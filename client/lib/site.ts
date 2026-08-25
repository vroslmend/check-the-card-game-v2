// The canonical origin, in one place because three files need it absolute:
// the root metadataBase, the sitemap's entries and the robots sitemap line.
//
// Deliberately not read from the environment. A preview deployment should
// still declare production as canonical, and Next's fallback chain is what
// this exists to escape: with no metadataBase it resolves social images
// against VERCEL_URL, the per-deployment hostname, or localhost in a local
// build. Neither is a URL anyone shares.
export const SITE_URL = "https://check-the-game.vercel.app";

// Read by the root description, the JSON-LD beside it and the manifest. Kept in
// one place because the manifest is the copy that quietly falls behind when it
// is not, and nothing about the site looks wrong when that happens.
export const SITE_DESCRIPTION =
  "Check is a free online card game for 2–6 players. You are dealt four cards but only get to see two, and the lowest hand wins the round.";
