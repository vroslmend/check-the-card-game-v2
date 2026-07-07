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
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PlayingCard } from "../cards/PlayingCard";
import { CardFlight } from "../cards/CardFlight";
import { cardTravelTransition } from "@/lib/card-motion";

export interface TableAreaProps {
  drawnCard?: PublicCard;
  dealingDeck?: PublicCard[];
}

// Newest match announcement in the log, as a primitive id.
const selectLatestMatchLogId = (state: UIMachineSnapshot) => {
  const log = state.context.currentGameState?.log;
  if (!log) return null;
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]!;
    if (
      entry.type === "public" &&
      entry.tags.includes("game-event") &&
      entry.message.includes(" matched a")
    ) {
      return entry.id;
    }
  }
  return null;
};

const MATCH_FLIGHT_MS = 650; // cardTravelTransition duration — pulse on landing
const MATCH_PULSE_MS = 400;

/** Momentary token that fires when a NEW match lands (baselined on mount,
 *  same rule as the stamps), delayed so the pulse hits as the card arrives. */
const useMatchPulse = (): string | null => {
  const latestId = useUISelector(selectLatestMatchLogId);
  const [pulse, setPulse] = React.useState<string | null>(null);
  const prevRef = React.useRef<string | null>(null);
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = latestId;
      return;
    }
    if (latestId && latestId !== prevRef.current) {
      prevRef.current = latestId;
      const arm = setTimeout(() => setPulse(latestId), MATCH_FLIGHT_MS);
      return () => clearTimeout(arm);
    }
    prevRef.current = latestId;
  }, [latestId]);

  React.useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(null), MATCH_PULSE_MS);
    return () => clearTimeout(t);
  }, [pulse]);

  return pulse;
};

// Newest reshuffle announcement in the log, as a primitive id.
const selectLatestShuffleLogId = (state: UIMachineSnapshot) => {
  const log = state.context.currentGameState?.log;
  if (!log) return null;
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]!;
    if (
      entry.type === "public" &&
      entry.tags.includes("game-event") &&
      entry.message.toLowerCase().includes("shuffl")
    ) {
      return entry.id;
    }
  }
  return null;
};

const SHUFFLE_BEAT_MS = 450;

/** Momentary token when the discard pile reshuffles into a fresh deck —
 *  baselined on mount, same rule as the stamps. */
const useReshuffleMoment = (): string | null => {
  const latestId = useUISelector(selectLatestShuffleLogId);
  const [beat, setBeat] = React.useState<string | null>(null);
  const prevRef = React.useRef<string | null>(null);
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevRef.current = latestId;
      return;
    }
    if (latestId && latestId !== prevRef.current) {
      prevRef.current = latestId;
      setBeat(latestId);
    }
  }, [latestId]);

  React.useEffect(() => {
    if (!beat) return;
    const t = setTimeout(() => setBeat(null), SHUFFLE_BEAT_MS);
    return () => clearTimeout(t);
  }, [beat]);

  return beat;
};

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

  const discardTopIsLocked = currentGameState?.discardTopIsLocked ?? false;

  return {
    deckSize: currentGameState?.deckSize ?? 0,
    deckTop: currentGameState?.deckTop ?? null,
    discardPileSize: currentGameState?.discardPileSize ?? 0,
    topDiscardCard: topDiscardCard,
    secondDiscardCard: currentGameState?.discardPile.at(-2) ?? null,
    discardPileIsSealed:
      (currentGameState?.discardPileIsSealed ?? false) || discardTopIsLocked,
    canDrawFromDeck: isDrawPhase,
    canDrawFromDiscard:
      isDrawPhase &&
      !currentGameState?.discardPileIsSealed &&
      !discardTopIsLocked &&
      (currentGameState?.discardPileSize ?? 0) > 0 &&
      !isSpecialCard,
    canDiscardDrawnCard: !!canDiscardDrawnCard,
    matchWindowOpen: !!currentGameState?.matchingOpportunity,
  };
};

export const TableArea = ({
  drawnCard,
  dealingDeck = [],
}: TableAreaProps) => {
  const { send } = useUIActorRef();
  const {
    deckSize,
    deckTop,
    discardPileSize,
    topDiscardCard,
    secondDiscardCard,
    discardPileIsSealed,
    canDrawFromDeck,
    canDrawFromDiscard,
    canDiscardDrawnCard,
    matchWindowOpen,
  } = useUISelector(selectTableAreaProps);

  const matchPulse = useMatchPulse();
  const reshuffleBeat = useReshuffleMoment();
  const reduced = useReducedMotion();

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
        <div className="relative z-0">
          <VisualCardStack
            title="Deck"
            count={deckSize}
            topCard={deckTop}
            faceDown
            canInteract={canDrawFromDeck}
            onClick={handleDeckClick}
            className="w-[min(8vh,15vw)]"
          />
          {/* During DEALING every dealt card sits here with its layoutId, so
              when the hands render on the next stage each card flies from the
              deck to its grid slot instead of popping into place. */}
          {dealingDeck.length > 0 && (
            <div className="absolute bottom-0 left-1/2 w-[min(8vh,15vw)] aspect-[5/7] -translate-x-1/2 pointer-events-none">
              {dealingDeck.map((card) => (
                <motion.div
                  key={card.id}
                  layoutId={card.id}
                  transition={cardTravelTransition}
                  className="absolute inset-0"
                >
                  <PlayingCard faceDown className="w-full h-full" />
                </motion.div>
              ))}
            </div>
          )}
          {/* Reshuffle: two ghost backs fan out behind the pile and collapse
              back in — the deck visibly re-forms. No layout projection. */}
          <AnimatePresence>
            {reshuffleBeat && !reduced && (
              <React.Fragment key={reshuffleBeat}>
                {[
                  [-8, -10],
                  [8, 10],
                ].map(([rot, dx]) => (
                  <motion.span
                    key={rot}
                    className="pointer-events-none absolute inset-0 -z-10 rounded-card bg-accent"
                    initial={{ opacity: 0.7, rotate: rot, x: dx }}
                    animate={{ opacity: 0, rotate: 0, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: SHUFFLE_BEAT_MS / 1000,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </React.Fragment>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* The drawn-card slot keeps its full size even while empty so the deck
          and discard piles don't shift sideways on every draw/discard. */}
      <div className="relative w-[min(8vh,15vw)] aspect-[5/7]">
        {/* Single-owner layoutId handoff — no entrance/exit poses here. On
            mount the card flies from the pile top that unmounted in the same
            commit; on unmount the hand cell or discard top picks the layoutId
            up and flies from this slot. Poses on layoutId elements
            double-animate against the shared-layout crossfade (the old
            draw/place flicker). */}
        {drawnCard && (
          <CardFlight
            key={drawnCard.id}
            layoutId={drawnCard.id}
            className="absolute inset-0 z-10 overflow-hidden rounded-card"
          >
            <PlayingCard
              card={"rank" in drawnCard ? (drawnCard as Card) : undefined}
              faceDown={"facedown" in drawnCard}
              className="w-full h-full"
            />
          </CardFlight>
        )}
      </div>

      <div className="flex justify-start w-full justify-self-start">
        <div className="relative">
          <VisualCardStack
            title="Discard"
            count={discardPileSize}
            topCard={topDiscardCard}
            secondCard={secondDiscardCard}
            isSealed={discardPileIsSealed}
            isMatchTarget={matchWindowOpen}
            canInteract={canDrawFromDiscard || canDiscardDrawnCard}
            onClick={handleDiscardClick}
            className="w-[min(8vh,15vw)]"
          />
          {/* A match lands with one quiet accent beat at the point of impact
              (the PENALTY. stamp owns the failure case). */}
          <AnimatePresence>
            {matchPulse && !reduced && (
              <motion.div
                key={matchPulse}
                className="pointer-events-none absolute inset-0 z-30 rounded-card ring-2 ring-accent"
                initial={{ opacity: 0.9, scale: 1 }}
                animate={{ opacity: 0, scale: 1.12 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: MATCH_PULSE_MS / 1000,
                  ease: "easeOut",
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
