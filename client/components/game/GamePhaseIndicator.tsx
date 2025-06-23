"use client";

import React from "react";
import { useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext";
import { GameStage } from "shared-types";
import { motion, AnimatePresence } from "framer-motion";

const selectGameStage = (state: UIMachineSnapshot) =>
  state.context.currentGameState?.gameStage;

const getStageDisplayInfo = (stage: GameStage | undefined) => {
  if (!stage) return null;

  const textMap: Partial<Record<GameStage, string>> = {
    [GameStage.DEALING]: "Dealing Cards",
    [GameStage.INITIAL_PEEK]: "Initial Peek",
    [GameStage.FINAL_TURNS]: "Final Turns",
    [GameStage.SCORING]: "Scoring",
    [GameStage.GAMEOVER]: "Game Over",
  };

  const text = textMap[stage];
  return text ? { text } : null;
};

export const GamePhaseIndicator = () => {
  const gameStage = useUISelector(selectGameStage);
  const displayInfo = getStageDisplayInfo(gameStage);

  return (
    <AnimatePresence>
      {displayInfo && (
        <motion.div
          key={gameStage}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-stone-100 bg-stone-800/80 dark:bg-black/60 backdrop-blur-md rounded-full shadow-lg ring-1 ring-white/10">
            {displayInfo.text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
