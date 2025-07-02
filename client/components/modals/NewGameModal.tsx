"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PlusCircle, Sparkles, ArrowRight } from "lucide-react";
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
import Magnetic from "@/components/ui/Magnetic";
import { useUIActorRef, useUISelector } from "@/context/GameUIContext";
import { useDevice } from "@/context/DeviceContext";

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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { isMobile } = useDevice();

  const { send } = useUIActorRef();
  const state = useUISelector((s) => s);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    setIsLoading(true);
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
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800">
        <div className="relative">
          <div className="relative p-6">
            <DialogHeader className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-2 flex items-center gap-2"
              >
                <div className="rounded-full bg-stone-100 dark:bg-zinc-900 p-1.5">
                  <PlusCircle className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                </div>
                <DialogTitle className="text-2xl font-light">
                  Create a New Game
                </DialogTitle>
              </motion.div>
              <DialogDescription className="text-stone-500 dark:text-stone-400">
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
                  className="text-sm font-normal text-stone-600 dark:text-stone-400"
                >
                  What should we call you?
                </Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="rounded-xl border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 h-12 px-4"
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                />
              </div>

              <div className="bg-stone-50 dark:bg-zinc-900 rounded-xl p-4 border border-stone-200/80 dark:border-zinc-800/80">
                <div className="flex items-start gap-3">
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-2 mt-0.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-stone-800 dark:text-stone-200 mb-1">
                      Game Master
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      As the creator, you'll be the Game Master with special
                      privileges to manage the game session.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <DialogFooter className="flex justify-end">
              {!isMobile ? (
                <Magnetic>
                  <Button
                    onClick={handleCreateGame}
                    disabled={isLoading}
                    className="rounded-xl px-8 py-6 h-auto bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 relative overflow-hidden group"
                    data-cursor-link
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {isLoading ? "Creating..." : "Create Game"}
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
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-stone-800 to-stone-700 dark:from-stone-200 dark:to-stone-300"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "0%" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </Button>
                </Magnetic>
              ) : (
                <Button
                  onClick={handleCreateGame}
                  disabled={isLoading}
                  className="rounded-xl px-8 py-6 h-auto bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 relative overflow-hidden group"
                  data-cursor-link
                >
                  {isLoading ? "Creating..." : "Create Game"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
