import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  // Initialise to false for identical server & first client render.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(query);

    // Update state on change events
    const listener = () => setMatches(media.matches);

    if (media.addEventListener) {
      media.addEventListener("change", listener);
    } else {
      // @ts-ignore – legacy fallback
      media.addListener(listener);
    }

    // Sync immediately after mount (covers StrictMode remount case)
    setMatches(media.matches);

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", listener);
      } else {
        // @ts-ignore – legacy fallback
        media.removeListener(listener);
      }
    };
    // Effect only re-runs if the query string itself changes.
  }, [query]);

  return matches;
}
