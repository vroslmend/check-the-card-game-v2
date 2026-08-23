"use client";

import React from "react";
import {
  useUISelector,
  useUIActorRef,
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

type GameView = "superseded" | "prompting" | "lobby" | "game" | "connecting";

const selectView = (s: UIMachineSnapshot): GameView => {
  // Checked before everything else: the board underneath is whatever arrived
  // last and will never update again, so showing it would be the silent freeze
  // this state exists to replace.
  if (s.matches({ inGame: "seatClaimedElsewhere" })) return "superseded";
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

// Shown to the client that just lost the seat to another window. The takeover
// itself is legitimate and expected once the game is installable, so this
// explains rather than apologises, and offers the way back that the machine
// used to take on its own after eight silent seconds.
const SupersededNotice = () => {
  const { send } = useUIActorRef();
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-hairline bg-surface p-8 text-center">
        <h3 className="text-2xl font-extrabold text-ink">
          You opened this game somewhere else
        </h3>
        <p className="text-sm text-ink-muted">
          Your seat moved to the window you opened most recently, so this one
          has stopped following the game. You can bring it back here.
        </p>
        <button
          onClick={() => send({ type: "RETRY_REJOIN" })}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-ink hover:bg-accent/90"
        >
          Play here instead
        </button>
        <button
          onClick={() => send({ type: "LEAVE_GAME" })}
          className="text-xs font-semibold text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default function GameUI() {
  const view = useUISelector(selectView);
  // Mounted here so the table's voice covers the lobby (joins, readies,
  // start) as well as the board.
  useGameSounds();

  const renderContent = () => {
    switch (view) {
      case "superseded":
        return <SupersededNotice />;
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
