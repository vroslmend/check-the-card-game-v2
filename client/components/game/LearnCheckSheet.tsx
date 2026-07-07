"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import {
  CardValuesStrip,
  PileDiagram,
  SetupPeekGrid,
} from "@/app/rules/illustrations";
import { cn } from "@/lib/utils";

interface Page {
  kicker: string;
  line: string;
  figure?: React.ReactNode;
}

const PAGES: Page[] = [
  {
    kicker: "The goal",
    line: "Lowest total wins. Aces are worth minus one; number cards score face value; Jack, Queen and King score 11, 12 and 13.",
    figure: <CardValuesStrip />,
  },
  {
    kicker: "Your hand",
    line: "Four cards, face down, in a 2x2 grid. At the start you may peek at your bottom two, once. Memorize them.",
    figure: <SetupPeekGrid />,
  },
  {
    kicker: "Your turn",
    line: "Draw from the draw pile or take the top discard. Every turn ends with a card landing face up on the discard pile.",
    figure: <PileDiagram showHand />,
  },
  {
    kicker: "Matching",
    line: "Any discard opens a five second window: throw a card of the exact same rank to shed it. A wrong rank costs you a penalty card.",
    figure: <PileDiagram sealed />,
  },
  {
    kicker: "Check",
    line: "Sure you're lowest? Call Check. Your hand locks, everyone else gets one final turn, then all hands are revealed and scored.",
  },
];

export function LearnCheckSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      setPage(0);
      closeRef.current?.focus();
    }
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowRight")
      setPage((p) => Math.min(p + 1, PAGES.length - 1));
    if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0));
  };

  const current = PAGES[page]!;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 font-game"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onKeyDown={onKeyDown}
        >
          <div
            className="absolute inset-0 bg-ground/70"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="How to play Check"
            className="relative flex w-full max-w-lg flex-col rounded-2xl border border-hairline bg-surface p-6"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
                {current.kicker}
              </p>
              <button
                ref={closeRef}
                onClick={onClose}
                className="-m-1.5 rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 min-h-[3.5rem]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={page}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-base font-semibold leading-relaxed text-ink"
                >
                  {current.line}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="mt-4 min-h-[10rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {current.figure ?? (
                    <p className="rounded-card border border-hairline p-5 text-sm leading-relaxed text-ink-muted">
                      The full rulebook, with every edge case, lives on the{" "}
                      <Link
                        href="/rules"
                        target="_blank"
                        className="font-semibold text-ink underline underline-offset-4"
                      >
                        rules page
                      </Link>
                      .
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-1.5" aria-hidden>
                {PAGES.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      i === page ? "bg-ink" : "bg-hairline",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
                  aria-label="Previous"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {page < PAGES.length - 1 ? (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-bold text-accent-ink hover:bg-accent/90"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="flex h-9 items-center rounded-full bg-accent px-4 text-sm font-bold text-accent-ink hover:bg-accent/90"
                  >
                    Got it
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
