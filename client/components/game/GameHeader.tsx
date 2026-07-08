"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  Copy,
  PanelRightClose,
  PanelRightOpen,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useUIActorRef,
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BrandMark } from "@/components/ui/BrandMark";
import {
  getVolume,
  isMuted,
  play,
  setMuted,
  setVolume,
} from "@/lib/sounds";

const selectGameHeaderProps = (state: UIMachineSnapshot) => ({
  gameId: state.context.gameId,
  isSidePanelOpen: state.context.isSidePanelOpen,
  chatCount: state.context.currentGameState?.chat?.length ?? 0,
});

const ICON_BUTTON =
  "flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink";

export const GameHeader = () => {
  const { send } = useUIActorRef();
  const { gameId, isSidePanelOpen, chatCount } =
    useUISelector(selectGameHeaderProps);

  // Baseline on first sight: history isn't news (mount/rejoin shows no dot).
  const seenChatCountRef = React.useRef<number | null>(null);
  if (seenChatCountRef.current === null) seenChatCountRef.current = chatCount;
  React.useEffect(() => {
    if (isSidePanelOpen) seenChatCountRef.current = chatCount;
  }, [isSidePanelOpen, chatCount]);
  const hasUnread =
    !isSidePanelOpen && chatCount > (seenChatCountRef.current ?? 0);

  const [copied, setCopied] = React.useState(false);
  const copyCode = () => {
    if (!gameId) return;
    navigator.clipboard?.writeText(gameId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Default true matches the SSR value (no localStorage on the server); the
  // effect syncs the real preference after mount — no hydration mismatch
  // when the user has previously unmuted.
  const [muted, setMutedState] = React.useState(true);
  const [volume, setVolumeState] = React.useState(0.7);
  React.useEffect(() => {
    setMutedState(isMuted());
    setVolumeState(getVolume());
  }, []);
  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
    // Audible confirmation exactly when turning sound ON (gain is already
    // open by the time this fires; muting stays silent).
    play("click");
  };
  // Dragging the slider is the finer control: 0 mutes, any positive value
  // unmutes so raising the level always makes sound audible.
  const changeVolume = (next: number) => {
    setVolume(next);
    setVolumeState(next);
    const shouldMute = next === 0;
    if (shouldMute !== muted) {
      setMuted(shouldMute);
      setMutedState(shouldMute);
    }
  };

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-ground px-4 font-game md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="group flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink"
        >
          <ChevronLeft className="h-4 w-4 text-ink-muted transition-transform group-hover:-translate-x-0.5" />
          <BrandMark className="h-6 rounded-[4px]" />
          Check
        </Link>
        <span className="text-hairline" aria-hidden>
          ·
        </span>
        {gameId && (
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold tracking-widest text-ink-muted tabular-nums transition-colors hover:text-ink"
            aria-label={copied ? "Code copied" : `Copy game code ${gameId}`}
          >
            {gameId}
            {copied ? (
              <Check className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="group relative">
          <button
            onClick={toggleMute}
            className={ICON_BUTTON}
            aria-label={muted ? "Turn sound on" : "Turn sound off"}
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : volume < 0.5 ? (
              <Volume1 className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          {/* Volume slider reveals to the left of the button, inline in the
              header bar, on hover/focus of the button group. */}
          <div className="pointer-events-none absolute right-full top-1/2 z-30 -translate-y-1/2 pr-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
            <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-2 shadow-lg">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Sound volume"
                className="h-1 w-24 cursor-pointer accent-accent"
              />
            </div>
          </div>
        </div>

        <ThemeToggle />

        <button
          onClick={() => {
            play("click");
            send({ type: "TOGGLE_SIDE_PANEL" });
          }}
          className={`relative ${ICON_BUTTON}`}
          aria-label={
            hasUnread
              ? "Toggle side panel (new messages)"
              : "Toggle side panel"
          }
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={isSidePanelOpen ? "open" : "closed"}
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              {isSidePanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </motion.span>
          </AnimatePresence>
          {hasUnread && (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent"
              aria-hidden
            />
          )}
          <span className="sr-only">
            {hasUnread
              ? "Toggle side panel (new messages)"
              : "Toggle side panel"}
          </span>
        </button>
      </div>
    </header>
  );
};
