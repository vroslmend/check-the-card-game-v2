"use client";

import React from "react";
import { useUISelector } from "@/context/GameUIContext";
import { GameBoard } from "@/components/game/GameBoard";
import { GameLobby } from "@/components/game/GameLobby";
import LoadingOrError from "@/components/layout/LoadingOrError";
import { RejoinModal } from "@/components/modals/RejoinModal";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import CardAnimationRoot from "@/components/cards/CardAnimationRoot";
import { GameStage } from "shared-types";

const selectStableView = (s: any) => {
  if (
    s.context.modal?.type === "rejoin" ||
    s.matches({ inGame: "promptToJoin" })
  ) {
    return "loading";
  }
  if (s.context.currentGameState?.gameStage === GameStage.WAITING_FOR_PLAYERS) {
    return "lobby";
  }
  if (s.context.currentGameState?.gameStage) {
    return "game";
  }
  return "loading";
};

export default function GameUI() {
  const { state, gameStage, modalType, view } = useUISelector((s) => ({
    state: s,
    gameStage: s.context.currentGameState?.gameStage,
    modalType: s.context.modal?.type,
    view: selectStableView(s),
  }));

  const renderContent = () => {
    if (modalType === "rejoin" || state.matches({ inGame: "promptToJoin" })) {
      return <LoadingOrError message="Awaiting your input..." />;
    }

    if (gameStage) {
      if (gameStage === GameStage.WAITING_FOR_PLAYERS) {
        return <GameLobby />;
      }
      return <GameBoard />;
    }

    return <LoadingOrError message="Connecting..." />;
  };

  return (
    <CardAnimationRoot>
      <main className="fixed inset-0 overflow-hidden bg-stone-100 dark:bg-zinc-900">
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
