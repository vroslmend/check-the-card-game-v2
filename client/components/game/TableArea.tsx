"use client";

import React from "react";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { type PublicCard, TurnPhase, PlayerActionType } from "shared-types";
import { DrawnCardArea } from "./DrawnCardArea";
import { VisualCardStack } from "../cards/VisualCardStack";
import { AnimatePresence, motion } from "framer-motion";

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
    canDrawFromDiscard: isDrawPhase && !currentGameState?.discardPileIsSealed,
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
    <div className="grid grid-cols-3 grid-rows-1 gap-x-4 justify-items-center items-start">
      <VisualCardStack
        title="Deck"
        count={deckSize}
        topCard={deckTop}
        faceDown
        canInteract={canDrawFromDeck}
        onClick={handleDeckClick}
        size="xs"
      />

      <div className="flex justify-center min-w-[64px] col-start-2">
        <AnimatePresence>
          {drawnCard && (
            <motion.div
              layoutId={drawnCard.id}
              initial={{ opacity: 0, scale: 0.5, y: -50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 50 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10"
            >
              <DrawnCardArea card={drawnCard} size="xs" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <VisualCardStack
        title="Discard"
        count={discardPile.length}
        topCard={topDiscardCard}
        isSealed={discardPileIsSealed}
        canInteract={canDrawFromDiscard}
        onClick={handleDiscardClick}
        size="xs"
      />
    </div>
  );
};
