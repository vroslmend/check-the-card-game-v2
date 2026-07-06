"use client";

import React from "react";
import { toast } from "sonner";
import { Ban, Info, Shuffle, Sparkles, type LucideIcon } from "lucide-react";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";

const selectLog = (state: UIMachineSnapshot) =>
  state.context.currentGameState?.log ?? null;

// Display-only glyph so announcements scan like the game's own status chips
// (icon + text). Keyed off the server copy; unknown events fall back to Info.
const glyphFor = (message: string): LucideIcon => {
  const m = message.toLowerCase();
  if (m.includes("matched")) return Sparkles;
  if (m.includes("shuffled")) return Shuffle;
  if (m.includes("disqualified")) return Ban;
  return Info;
};

/**
 * Surfaces public game events (match results, disqualifications, reshuffles)
 * as transient announcements. Rendered via toast.custom as a game-native
 * pill — sonner's styled default is an OS-notification card, which is the
 * wrong vocabulary for a table announcement. The SidePanel keeps the full
 * history; ability events stay off the rail (board rings show those), and
 * penalties own the center stamp.
 */
export const GameEventToasts = () => {
  const log = useUISelector(selectLog);
  // Everything present on first sight (mount, rejoin) is history, not news.
  const seenIds = React.useRef<Set<string> | null>(null);

  React.useEffect(() => {
    if (!log) return;
    if (seenIds.current === null) {
      seenIds.current = new Set(log.map((entry) => entry.id));
      return;
    }
    for (const entry of log) {
      if (seenIds.current.has(entry.id)) continue;
      seenIds.current.add(entry.id);
      if (
        entry.type === "public" &&
        entry.tags.includes("game-event") &&
        !entry.tags.includes("ability") &&
        !entry.tags.includes("penalty")
      ) {
        const Icon = glyphFor(entry.message);
        toast.custom(
          () => (
            <div className="mx-auto flex w-fit items-center gap-2 rounded-pill border border-hairline bg-surface px-4 py-2 shadow-sm font-game text-sm font-semibold text-ink">
              <Icon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
              <span>{entry.message}</span>
            </div>
          ),
          { duration: 4000 },
        );
      }
    }
  }, [log]);

  return null;
};
