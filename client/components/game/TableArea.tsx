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

// ✨ INTERFACE MODIFIED HERE
export interface TableAreaProps {
  drawnCard?: PublicCard;
  dealingDeck?: PublicCard[]; // This prop is now officially defined
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

// ✨ COMPONENT SIGNATURE MODIFIED HERE
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
    // Prevent clicking the deck during the dealing animation
    if (canDrawFromDeck && dealingDeck.length === 0) {
      send({ type: PlayerActionType.DRAW_FROM_DECK });
    }
  };

  const handleDiscardClick = () => {
    if (canDrawFromDiscard) {
      send({ type: PlayerActionType.DRAW_FROM_DISCARD });
    }
  };

  // ✨ LOGIC TO COMBINE DECKS FOR DEALING ANIMATION
  const deckForRender = deckSize > 0 && deckTop ? [deckTop] : [];
  const combinedDeckForDealing = [...deckForRender, ...dealingDeck];

  return (
    <div className="grid grid-cols-3 gap-x-4 justify-items-center items-start">
      {/* Deck */}
      <div className="relative w-full h-full flex items-center justify-center">
        <AnimatePresence>
          {combinedDeckForDealing.length > 0 ? (
            combinedDeckForDealing.map((card, index) => (
              <motion.div
                key={card.id}
                className="absolute"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.3 }}
              >
                <VisualCardStack
                  title={index === 0 ? "Deck" : ""}
                  count={deckSize + dealingDeck.length}
                  topCard={card}
                  faceDown
                  canInteract={canDrawFromDeck && dealingDeck.length === 0}
                  onClick={handleDeckClick}
                  size="xs"
                />
              </motion.div>
            ))
          ) : (
            <VisualCardStack title="Deck" count={0} size="xs" />
          )}
        </AnimatePresence>
      </div>

      {/* Drawn Card Area */}
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

      {/* Discard Pile */}
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
