"use client";

import React from "react";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import {
  type PublicCard,
  TurnPhase,
  PlayerActionType,
  Card,
} from "shared-types";
import { VisualCardStack } from "../cards/VisualCardStack";
import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "../cards/PlayingCard";

export interface TableAreaProps {
  drawnCard?: PublicCard;
  dealingDeck?: PublicCard[];
}

const selectTableAreaProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId } = state.context;
  const isMyTurn = currentGameState?.currentPlayerId === localPlayerId;
  const isDrawPhase =
    isMyTurn && currentGameState?.turnPhase === TurnPhase.DRAW;

  return {
    deckSize: currentGameState?.deckSize ?? 0,
    deckTop: currentGameState?.deckTop ?? null,
    discardPile: currentGameState?.discardPile ?? [],
    topDiscardCard: currentGameState?.discardPile.at(-1) ?? null,
    discardPileIsSealed: currentGameState?.discardPileIsSealed ?? false,
    canDrawFromDeck: isDrawPhase,
    canDrawFromDiscard: isDrawPhase && !currentGameState?.discardPileIsSealed && !!currentGameState?.discardPile.length,
  };
};

export const TableArea = ({ drawnCard, dealingDeck = [] }: TableAreaProps) => {
  const { send } = useUIActorRef();
  const {
    deckSize,
    deckTop,
    discardPile,
    topDiscardCard,
    discardPileIsSealed,
    canDrawFromDeck,
    canDrawFromDiscard,
  } = useUISelector(selectTableAreaProps);

  const handleDeckClick = () => {
    if (canDrawFromDeck && dealingDeck.length === 0) {
      send({ type: PlayerActionType.DRAW_FROM_DECK });
    }
  };

  const handleDiscardClick = () => {
    if (canDrawFromDiscard) {
      send({ type: PlayerActionType.DRAW_FROM_DISCARD });
    }
  };

  const deckForRender = deckSize > 0 && deckTop ? [deckTop] : [];
  const combinedDeckForDealing = [...deckForRender, ...dealingDeck];

  return (
    <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="flex justify-end w-full justify-self-end"
      >
        <VisualCardStack
          title="Deck"
          count={deckSize}
          topCard={deckTop}
          faceDown
          canInteract={canDrawFromDeck}
          onClick={handleDeckClick}
          className="landscape:w-[8vh] portrait:w-[15vw]"
        />
      </motion.div>

      <div className="flex items-center justify-center">
        <AnimatePresence>
          {drawnCard && (
            <motion.div
              layoutId={drawnCard.id}
              initial={{ opacity: 0, scale: 0.5, y: -50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 50 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 landscape:w-[8vh] portrait:w-[15vw] aspect-[5/7]"
            >
              <PlayingCard
                card={"rank" in drawnCard ? (drawnCard as Card) : undefined}
                faceDown={"facedown" in drawnCard}
                className="w-full h-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="flex justify-start w-full justify-self-start"
      >
        <VisualCardStack
          title="Discard"
          count={discardPile.length}
          topCard={topDiscardCard}
          isSealed={discardPileIsSealed}
          canInteract={canDrawFromDiscard}
          onClick={handleDiscardClick}
          className="landscape:w-[8vh] portrait:w-[15vw]"
        />
      </motion.div>
    </div>
  );
};
