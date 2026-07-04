"use client";

import React from "react";
import { useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext";
import { HandGrid } from "./HandGrid";
import { type Player, type Card, GameStage } from "shared-types";
import { cn } from "@/lib/utils";
import { PlayingCard } from "../cards/PlayingCard";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Eye } from "lucide-react";

interface PlayerHandProps {
  player: Player;
  isLocalPlayer: boolean;
  onCardClick: (cardIndex: number) => void;
  className?: string;
  canInteract: boolean;
  isLocked?: boolean;
  selectedCardIndex?: number | null;
}

const selectContext = (state: UIMachineSnapshot) => {
  const ability = state.context.currentAbilityContext;
  return {
    visibleCards: state.context.visibleCards,
    abilityStage: ability?.stage ?? null,
    selectedPeekTargets: ability?.selectedPeekTargets,
    selectedSwapTargets: ability?.selectedSwapTargets,
    publicPeek: state.context.currentGameState?.publicPeek ?? null,
    localPlayerId: state.context.localPlayerId,
    gameStage: state.context.currentGameState?.gameStage ?? null,
  };
};

const PlayerHand: React.FC<PlayerHandProps> = ({
  player,
  isLocalPlayer,
  onCardClick,
  className,
  canInteract,
  isLocked = false,
  selectedCardIndex = null,
}) => {
  const {
    visibleCards,
    abilityStage,
    selectedPeekTargets,
    selectedSwapTargets,
    publicPeek,
    localPlayerId,
    gameStage,
  } = useUISelector(selectContext);
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");

  const handToDisplay = isLocalPlayer
    ? player.hand.map((card) => ({ facedown: true as const, id: card.id }))
    : player.hand;

  // Opponents sit across the table: rotate their grid 180° (row-major
  // reversal) so their bottom peek row reads at the top of your screen,
  // like a real table. `index` stays the ORIGINAL hand index — peek rings,
  // visibleCards and click targets all key off the server-side index.
  const handEntries = handToDisplay.map((card, index) => ({ card, index }));
  const displayEntries = isLocalPlayer ? handEntries : [...handEntries].reverse();

  // Everyone is looking at their bottom two cards right now; show opponents
  // which slots those are (real-life parity: you see the cards being lifted).
  const initialPeekActive =
    gameStage === GameStage.INITIAL_PEEK &&
    visibleCards.some((vc) => vc.source === "initial-peek");

  const combinedClass = cn(isLocked && "grayscale opacity-60");

  return (
    <HandGrid numItems={handToDisplay.length} className={combinedClass}>
      {displayEntries.map(({ card, index }) => {
        const isCardVisible = visibleCards.some(
          (vc) => vc.playerId === player.id && vc.cardIndex === index,
        );

        const visibleCardData = isCardVisible
          ? visibleCards.find(
              (vc) => vc.playerId === player.id && vc.cardIndex === index,
            )?.card
          : undefined;

        let cardToRender = handToDisplay[index];

        if (isCardVisible) {
          cardToRender = visibleCardData || player.hand[index];
        }
        const isFaceUp = "rank" in cardToRender;

        const isMatchSelected = selectedCardIndex === index;
        const isAbilityPeekSelected =
          abilityStage === "peeking" &&
          !!selectedPeekTargets?.some(
            (t) => t.playerId === player.id && t.cardIndex === index,
          );
        const isAbilitySwapSelected =
          abilityStage === "swapping" &&
          !!selectedSwapTargets?.some(
            (t) => t.playerId === player.id && t.cardIndex === index,
          );
        const abilityRingClass = isAbilityPeekSelected
          ? "ring-yellow-300/70"
          : isAbilitySwapSelected
            ? "ring-pink-400/70"
            : "";
        const isSelected =
          isMatchSelected || isAbilityPeekSelected || isAbilitySwapSelected;

        // Someone else's confirmed ability peek on this slot — everyone sees
        // WHICH card is being looked at, never its face. The server clears
        // publicPeek (and re-broadcasts) when the peek window ends.
        const isPeekedByOther =
          !!publicPeek &&
          publicPeek.peekerId !== localPlayerId &&
          publicPeek.targets.some(
            (t) => t.playerId === player.id && t.cardIndex === index,
          );
        const showPeekIndicator =
          isPeekedByOther ||
          (initialPeekActive &&
            !isLocalPlayer &&
            index >= handToDisplay.length - 2);

        return (
          <div
            key={card.id}
            className="relative w-[min(8vh,15vw)] aspect-[5/7]"
          >
            <motion.div
              key={card.id}
              layoutId={card.id}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className={cn(
                "absolute inset-0",
                "data-[interactive=true]:cursor-pointer",
                "data-[interactive=true]:hover:filter-[brightness(1.15)]",
              )}
              data-interactive={canInteract && !isLocked}
              onClick={() => canInteract && !isLocked && onCardClick?.(index)}
              whileHover={
                canInteract && !isLocked && canHover
                  ? { y: -8, scale: 1.05 }
                  : {}
              }
            >
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    key="sel-ring"
                    className={cn(
                      "absolute inset-0.5 rounded-md pointer-events-none",
                      "ring-[4px]",
                      isMatchSelected ? "ring-sky-400/80" : abilityRingClass,
                    )}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  />
                )}
                {showPeekIndicator && (
                  <motion.div
                    key="peek-indicator"
                    className="absolute inset-0.5 rounded-md pointer-events-none z-20 ring-[3px] ring-amber-400/80"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 text-zinc-900 p-1 shadow-md">
                      <Eye className="h-3 w-3" />
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <PlayingCard
                card={isFaceUp ? (cardToRender as Card) : undefined}
                faceDown={!isFaceUp}
                className="h-full w-full"
              />
            </motion.div>
          </div>
        );
      })}
    </HandGrid>
  );
};

export default PlayerHand;
