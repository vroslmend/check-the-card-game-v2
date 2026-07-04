"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Users,
  Shield,
  ArrowRight,
  Loader2,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
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
      toast.error("Please enter a game ID and your name.");
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
      toast.error("Please enter a game ID.");
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

  const resetAndClose = () => {
    setStep(1);
    setIsModalOpen(false);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={resetAndClose}>
      <DialogContent
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
        className="sm:max-w-[425px] p-0 overflow-hidden bg-surface border border-hairline"
      >
        <div className="relative">
          <div className="relative p-6">
            <DialogHeader className="mb-6">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-2 flex items-center gap-2"
              >
                <div className="rounded-full bg-surface-2 p-1.5">
                  <Users className="h-4 w-4 text-ink-muted" />
                </div>
                <DialogTitle className="text-2xl font-bold text-ink">
                  Join a Game
                </DialogTitle>
              </motion.div>
              <DialogDescription className="text-ink-muted">
                Connect with friends and join an existing game session.
              </DialogDescription>
            </DialogHeader>

            <div className="mb-6">
              <div className="flex justify-between mb-4">
                <div
                  className={cn(
                    "flex items-center gap-2",
                    step >= 1 ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold",
                      step >= 1
                        ? "bg-ink text-ground"
                        : "bg-surface-2 text-ink-muted border border-hairline",
                    )}
                  >
                    {step > 1 ? <CheckCircle className="h-4 w-4" /> : "1"}
                  </div>
                  <span className="text-sm">Your Identity</span>
                </div>
                <div className="flex-1 border-t border-dashed border-hairline self-center mx-2"></div>
                <div
                  className={cn(
                    "flex items-center gap-2",
                    step >= 2 ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold",
                      step >= 2
                        ? "bg-ink text-ground"
                        : "bg-surface-2 text-ink-muted border border-hairline",
                    )}
                  >
                    2
                  </div>
                  <span className="text-sm">Game Code</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="name-step"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor="player-name"
                        className="text-sm font-normal text-ink-muted"
                      >
                        What should we call you?
                      </Label>
                      <Input
                        id="player-name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your name"
                        className="rounded-xl border-hairline bg-surface h-12 px-4"
                        onKeyDown={onKeyDown}
                        autoComplete="off"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="game-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor="game-id"
                        className="text-sm font-normal text-ink-muted"
                      >
                        Enter the game ID provided by your friend
                      </Label>
                      <Input
                        id="game-id"
                        value={gameId}
                        onChange={(e) => setGameId(e.target.value)}
                        placeholder="Game ID"
                        className="rounded-xl border-hairline bg-surface h-12 px-4 font-mono"
                        onKeyDown={onKeyDown}
                        autoComplete="off"
                      />
                      <p className="text-xs text-ink-muted mt-2">
                        <Shield className="h-3 w-3 inline mr-1" />
                        Make sure you have the correct code from the game
                        creator
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DialogFooter className="flex items-center justify-between mt-8">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="rounded-full border-hairline"
                  data-cursor-link
                >
                  Back
                </Button>
              )}
              <div className={step === 1 ? "ml-auto" : ""}>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isLoading}
                  className="rounded-full px-8 py-6 h-auto bg-accent text-accent-ink hover:bg-accent/90"
                  data-cursor-link
                >
                  {/* Constant label + arrow↔spinner swap keeps the button the
                      same width while loading (no size jump). */}
                  <span className="flex items-center gap-2">
                    {step === 1 ? "Continue" : "Join Game"}
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
              </div>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
