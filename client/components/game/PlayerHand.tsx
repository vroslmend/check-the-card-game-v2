"use client";

import React from "react";
import { useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext";
import { HandGrid } from "./HandGrid";
import { type Player, type Card, type PublicCard } from "shared-types";
import { cn } from "@/lib/utils";
import { PlayingCard } from "../cards/PlayingCard";
import { motion, AnimatePresence } from "framer-motion";

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
    abilitySelectionInfo: {
      stage: ability?.stage ?? null,
      selectedPeekTargets: ability?.selectedPeekTargets ?? [],
      selectedSwapTargets: ability?.selectedSwapTargets ?? [],
    },
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
  const { visibleCards, abilitySelectionInfo } = useUISelector(selectContext);

  const handToDisplay = isLocalPlayer
    ? player.hand.map((card) => ({ facedown: true as const, id: card.id }))
    : player.hand;

  const combinedClass = cn(isLocked && "grayscale opacity-60");

  return (
    <HandGrid
      numItems={handToDisplay.length}
      className={combinedClass}
      isLocalPlayer={isLocalPlayer}
      cardToSelect={selectedCardIndex}
    >
      {handToDisplay.map((card, index) => {
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
          abilitySelectionInfo.stage === "peeking" &&
          abilitySelectionInfo.selectedPeekTargets.some(
            (t) => t.playerId === player.id && t.cardIndex === index,
          );
        const isAbilitySwapSelected =
          abilitySelectionInfo.stage === "swapping" &&
          abilitySelectionInfo.selectedSwapTargets.some(
            (t) => t.playerId === player.id && t.cardIndex === index,
          );
        const abilityRingClass = isAbilityPeekSelected
          ? "ring-yellow-300/70"
          : isAbilitySwapSelected
            ? "ring-pink-400/70"
            : "";
        const isSelected =
          isMatchSelected || isAbilityPeekSelected || isAbilitySwapSelected;

        return (
          <div
            key={card.id}
            className="relative landscape:w-[8vh] portrait:w-[15vw] aspect-[5/7]"
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
                canInteract && !isLocked
                  ? {
                      y: -8,
                      scale: 1.05,
                    }
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
