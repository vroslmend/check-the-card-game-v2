// The canonical origin, in one place because three files need it absolute:
// the root metadataBase, the sitemap's entries and the robots sitemap line.
//
// Deliberately not read from the environment. A preview deployment should
// still declare production as canonical, and Next's fallback chain is what
// this exists to escape: with no metadataBase it resolves social images
// against VERCEL_URL, the per-deployment hostname, or localhost in a local
// build. Neither is a URL anyone shares.
export const SITE_URL = "https://check-the-game.vercel.app";

// The one sentence that says what the game is, here for the same reason as the
// origin above: three things read it, and they have to agree. The root
// description, the JSON-LD block beside it, and the manifest that the install
// prompt shows. Written out separately in each, the manifest is the one that
// quietly falls behind, because nothing about the site looks wrong when it
// does. Sized to the roughly 155 characters a search result prints.
export const SITE_DESCRIPTION =
  "Deal four cards, peek at two, play for the lowest hand. A free browser card game for 2 to 6 players. Create a lobby, send the link, no account needed.";
