import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  // Initialise to false for identical server & first client render.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);

    if (media.addEventListener) {
      media.addEventListener("change", listener);
    } else {
      // Legacy Safari fallback
      media.addListener(listener);
    }

    // Sync immediately after mount (covers StrictMode remount case).
    setMatches(media.matches);

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", listener);
      } else {
        media.removeListener(listener);
      }
    };
    // Effect only re-runs if the query string itself changes. Including
    // `matches` here (the old bug) tore down and re-created the listener on
    // every media-query flip.
  }, [query]);

  return matches;
}
