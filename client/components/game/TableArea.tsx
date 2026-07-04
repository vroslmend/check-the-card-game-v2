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
  CardRank,
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
  const localPlayer = localPlayerId
    ? currentGameState?.players[localPlayerId]
    : undefined;
  // Tapping the pile while holding a deck draw discards it directly (same
  // action as the action-bar button; discard-pile draws must be swapped).
  const canDiscardDrawnCard =
    isMyTurn &&
    currentGameState?.turnPhase === TurnPhase.DISCARD &&
    localPlayer?.pendingDrawnCard?.source === "deck";
  const topDiscardCard = currentGameState?.discardPile.at(-1) ?? null;

  const isSpecialCard =
    !!topDiscardCard &&
    "rank" in topDiscardCard &&
    [CardRank.King, CardRank.Queen, CardRank.Jack].includes(
      topDiscardCard.rank,
    );

  return {
    deckSize: currentGameState?.deckSize ?? 0,
    deckTop: currentGameState?.deckTop ?? null,
    discardPile: currentGameState?.discardPile ?? [],
    topDiscardCard: topDiscardCard,
    discardPileIsSealed: currentGameState?.discardPileIsSealed ?? false,
    canDrawFromDeck: isDrawPhase,
    canDrawFromDiscard:
      isDrawPhase &&
      !currentGameState?.discardPileIsSealed &&
      !!currentGameState?.discardPile.length &&
      !isSpecialCard,
    canDiscardDrawnCard: !!canDiscardDrawnCard,
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
    canDiscardDrawnCard,
  } = useUISelector(selectTableAreaProps);

  const handleDeckClick = () => {
    if (canDrawFromDeck && dealingDeck.length === 0) {
      send({ type: PlayerActionType.DRAW_FROM_DECK });
    }
  };

  const handleDiscardClick = () => {
    if (canDiscardDrawnCard) {
      send({ type: PlayerActionType.DISCARD_DRAWN_CARD });
    } else if (canDrawFromDiscard) {
      send({ type: PlayerActionType.DRAW_FROM_DISCARD });
    }
  };

  return (
    <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div className="flex justify-end w-full justify-self-end">
        <div className="relative">
          <VisualCardStack
            title="Deck"
            count={deckSize}
            topCard={deckTop}
            faceDown
            canInteract={canDrawFromDeck}
            onClick={handleDeckClick}
            className="landscape:w-[8vh] portrait:w-[15vw]"
          />
          {/* During DEALING every dealt card sits here with its layoutId, so
              when the hands render on the next stage each card flies from the
              deck to its grid slot instead of popping into place. */}
          {dealingDeck.length > 0 && (
            <div className="absolute bottom-0 left-1/2 landscape:w-[8vh] portrait:w-[15vw] aspect-[5/7] -translate-x-1/2 pointer-events-none">
              {dealingDeck.map((card) => (
                <motion.div
                  key={card.id}
                  layoutId={card.id}
                  className="absolute inset-0"
                >
                  <PlayingCard faceDown className="w-full h-full" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The drawn-card slot keeps its full size even while empty so the deck
          and discard piles don't shift sideways on every draw/discard. */}
      <div className="relative landscape:w-[8vh] portrait:w-[15vw] aspect-[5/7]">
        <AnimatePresence>
          {drawnCard && (
            <motion.div
              layoutId={drawnCard.id}
              initial={{ opacity: 0, scale: 0.5, y: -50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 50 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-0 z-10"
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

      <div className="flex justify-start w-full justify-self-start">
        <VisualCardStack
          title="Discard"
          count={discardPile.length}
          topCard={topDiscardCard}
          secondCard={discardPile.at(-2) ?? null}
          isSealed={discardPileIsSealed}
          canInteract={canDrawFromDiscard || canDiscardDrawnCard}
          onClick={handleDiscardClick}
          className="landscape:w-[8vh] portrait:w-[15vw]"
        />
      </div>
    </div>
  );
};
