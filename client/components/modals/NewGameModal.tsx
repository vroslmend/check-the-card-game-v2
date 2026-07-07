"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIActorRef, useUISelector } from "@/context/GameUIContext";

interface NewGameModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
}

export function NewGameModal({
  isModalOpen,
  setIsModalOpen,
}: NewGameModalProps) {
  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("localPlayerName") || "";
    }
    return "";
  });

  const { send } = useUIActorRef();
  // Loading state lives in the machine, so a failed request re-enables the
  // button instead of leaving the modal stuck on "Creating...".
  const isLoading = useUISelector((s) => s.hasTag("loading"));

  const handleCreateGame = () => {
    if (!playerName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    localStorage.setItem("localPlayerName", playerName);
    send({ type: "CREATE_GAME_REQUESTED", playerName });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCreateGame();
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
        className="gap-0 p-6 font-game sm:max-w-md sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          New table
        </p>
        <DialogTitle className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          Create a game
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-muted">
          You host the table: share the code, wait for your friends, start
          when everyone is ready.
        </DialogDescription>

        <div className="mt-6">
          <label
            htmlFor="name"
            className="text-sm font-semibold text-ink"
          >
            Your name
          </label>
          <input
            id="name"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoFocus
            maxLength={20}
            className="mt-2 h-12 w-full rounded-full border border-hairline bg-surface px-5 text-base text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent"
          />
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleCreateGame}
            disabled={isLoading}
            className="flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-base font-bold text-accent-ink transition-colors hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
            data-cursor-link
          >
            {/* Constant label + arrow/spinner swap keeps the button the same
                width while loading (no size jump). */}
            Create game
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
