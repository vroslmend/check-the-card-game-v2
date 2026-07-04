"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PlusCircle, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        className="sm:max-w-[425px] p-0 overflow-hidden bg-surface border border-hairline"
      >
        <div className="relative">
          <div className="relative p-6">
            <DialogHeader className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-2 flex items-center gap-2"
              >
                <div className="rounded-full bg-surface-2 p-1.5">
                  <PlusCircle className="h-4 w-4 text-ink-muted" />
                </div>
                <DialogTitle className="text-2xl font-bold text-ink">
                  Create a New Game
                </DialogTitle>
              </motion.div>
              <DialogDescription className="text-ink-muted">
                Start a new game session and invite friends to join.
              </DialogDescription>
            </DialogHeader>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-8 space-y-6"
            >
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm font-normal text-ink-muted"
                >
                  What should we call you?
                </Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="rounded-xl border-hairline bg-surface h-12 px-4"
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                />
              </div>

              <div className="bg-surface-2 rounded-xl p-4 border border-hairline">
                <div className="flex items-start gap-3">
                  <div className="bg-surface rounded-full p-2 mt-0.5">
                    <Sparkles className="h-4 w-4 text-ink-muted" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-ink mb-1">
                      Game Master
                    </h4>
                    <p className="text-xs text-ink-muted">
                      As the creator, you'll be the Game Master with special
                      privileges to manage the game session.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <DialogFooter className="flex justify-end">
              <Button
                onClick={handleCreateGame}
                disabled={isLoading}
                className="rounded-full px-8 py-6 h-auto bg-accent text-accent-ink hover:bg-accent/90"
                data-cursor-link
              >
                {/* Constant label + arrow↔spinner swap keeps the button the
                    same width while loading (no size jump). */}
                <span className="flex items-center gap-2">
                  Create Game
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </motion.div>
                  )}
                </span>
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
