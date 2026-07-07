"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUISelector, useUIActorRef } from "@/context/GameUIContext";

interface JoinGameModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
}

export function JoinGameModal({
  isModalOpen,
  setIsModalOpen,
}: JoinGameModalProps) {
  const [gameId, setGameId] = useState("");
  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("localPlayerName") || "";
    }
    return "";
  });
  const [step, setStep] = useState(1);

  // Loading state lives in the machine, so a failed join re-enables the
  // button instead of leaving the modal stuck on "Loading...".
  const isLoading = useUISelector((s) => s.hasTag("loading"));
  const { send } = useUIActorRef();

  const handleJoinGame = () => {
    if (!gameId.trim() || !playerName.trim()) {
      toast.error("Please enter a game code and your name.");
      return;
    }
    localStorage.setItem("localPlayerName", playerName);
    send({ type: "JOIN_GAME_REQUESTED", gameId: gameId.trim(), playerName });
  };

  const handleNextStep = () => {
    if (step === 1 && !playerName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (step === 2 && !gameId.trim()) {
      toast.error("Please enter a game code.");
      return;
    }
    if (step === 1) {
      setStep(2);
    } else {
      handleJoinGame();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleNextStep();
    }
  };

  const resetAndClose = (open: boolean) => {
    setStep(1);
    setIsModalOpen(open);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={resetAndClose}>
      <DialogContent
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
        className="gap-0 p-6 font-game sm:max-w-md sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Join a table · step {step} of 2
        </p>
        <DialogTitle className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          Join a game
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-muted">
          {step === 1
            ? "Tell the table who you are."
            : "Enter the code from whoever made the table."}
        </DialogDescription>

        <div className="mt-6 min-h-[6rem]">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="name-step"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <label
                  htmlFor="player-name"
                  className="text-sm font-semibold text-ink"
                >
                  Your name
                </label>
                <input
                  id="player-name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                  autoFocus
                  maxLength={20}
                  className="mt-2 h-12 w-full rounded-full border border-hairline bg-surface px-5 text-base text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent"
                />
              </motion.div>
            ) : (
              <motion.div
                key="game-step"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <label
                  htmlFor="game-id"
                  className="text-sm font-semibold text-ink"
                >
                  Game code
                </label>
                <input
                  id="game-id"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value.toUpperCase())}
                  placeholder="ABC12"
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                  autoFocus
                  maxLength={12}
                  className="mt-2 h-12 w-full rounded-full border border-hairline bg-surface px-5 text-center text-lg font-bold uppercase tracking-[0.3em] text-ink outline-none transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-muted focus:border-accent"
                />
                <p className="mt-2 text-xs text-ink-muted">
                  Five characters, shown big in the host's lobby.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-12 items-center rounded-full border border-hairline bg-surface px-5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
              data-cursor-link
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleNextStep}
            disabled={isLoading}
            className="flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-base font-bold text-accent-ink transition-colors hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
            data-cursor-link
          >
            {/* Constant label + arrow/spinner swap keeps the button the same
                width while loading (no size jump). */}
            {step === 1 ? "Continue" : "Join game"}
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
