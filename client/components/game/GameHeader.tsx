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
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useUIActorRef,
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { isMuted, setMuted } from "@/lib/sounds";

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
  React.useEffect(() => {
    setMutedState(isMuted());
  }, []);
  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-ground px-4 font-game md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="group flex items-center gap-1 text-lg font-extrabold tracking-tight text-ink"
        >
          <ChevronLeft className="h-4 w-4 text-ink-muted transition-transform group-hover:-translate-x-0.5" />
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
        <button
          onClick={toggleMute}
          className={ICON_BUTTON}
          aria-label={muted ? "Turn sound on" : "Turn sound off"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        <ThemeToggle />

        <button
          onClick={() => send({ type: "TOGGLE_SIDE_PANEL" })}
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
