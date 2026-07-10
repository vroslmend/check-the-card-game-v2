"use client";

import React from "react";
import {
  useUISelector,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { GameBoard } from "@/components/game/GameBoard";
import { GameLobby } from "@/components/game/GameLobby";
import LoadingOrError from "@/components/layout/LoadingOrError";
import { RejoinModal } from "@/components/modals/RejoinModal";
import { motion, AnimatePresence } from "framer-motion";
import CardAnimationRoot from "@/components/cards/CardAnimationRoot";
import { GameStage } from "shared-types";
import { useGameSounds } from "@/components/game/useGameSounds";
import { useServerKeepalive } from "@/hooks/use-server-keepalive";

type GameView = "prompting" | "lobby" | "game" | "connecting";

const selectView = (s: UIMachineSnapshot): GameView => {
  if (
    s.context.modal?.type === "rejoin" ||
    s.matches({ inGame: "promptToJoin" })
  ) {
    return "prompting";
  }
  const gameStage = s.context.currentGameState?.gameStage;
  if (gameStage === GameStage.WAITING_FOR_PLAYERS) return "lobby";
  if (gameStage) return "game";
  return "connecting";
};

export default function GameUI() {
  const view = useUISelector(selectView);
  // Mounted here so the table's voice covers the lobby (joins, readies,
  // start) as well as the board.
  useGameSounds();
  // Any open game page keeps the free-tier host from idling out under a
  // waiting lobby (details in the hook).
  useServerKeepalive();

  const renderContent = () => {
    switch (view) {
      case "prompting":
        return <LoadingOrError message="Awaiting your input..." />;
      case "lobby":
        return <GameLobby />;
      case "game":
        return <GameBoard />;
      default:
        return <LoadingOrError message="Connecting..." />;
    }
  };

  return (
    <CardAnimationRoot>
      <main className="relative h-screen w-full select-none overflow-hidden bg-ground">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        <RejoinModal />
      </main>
    </CardAnimationRoot>
  );
}
