"use client";

import { PlayingCard } from "@/components/cards/PlayingCard";
import type { PlayerId, PublicCard } from "shared-types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUISelector } from "@/context/GameUIContext";

export interface HandGridProps {
  ownerId: PlayerId;
  hand: PublicCard[];
  canInteract: boolean;
  onCardClick?: (card: PublicCard | null, index: number) => void;
  selectedCardIndices?: number[];
  className?: string;
  cardSize?: "xxs" | "xs" | "sm" | "md" | "lg";
}

export const HandGrid = ({
  ownerId,
  hand,
  canInteract,
  onCardClick,
  selectedCardIndices = [],
  className,
  cardSize = "xs",
}: HandGridProps) => {
  const visibleCards = useUISelector((state) => state.context.visibleCards);
  const localPlayerId = useUISelector((state) => state.context.localPlayerId);

  const abilitySelectionInfo = useUISelector((state) => {
    const ability = state.context.currentAbilityContext;
    return {
      stage: ability?.stage ?? null,
      selectedPeekTargets: ability?.selectedPeekTargets ?? [],
      selectedSwapTargets: ability?.selectedSwapTargets ?? [],
    };
  });

  // The grid size is the maximum number of cards a player can have.
  // We will always render at least 4 slots, or more if the hand grows.
  const totalSlots = Math.max(4, hand.length);
  const slots = Array.from({ length: totalSlots });

  // The number of columns is half the number of slots, rounded up.
  const numColumns = Math.ceil(totalSlots / 2);

  return (
    <div
      className={cn("grid gap-1", className)}
      style={{
        gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`,
      }}
    >
      {slots.map((_, index) => {
        const card = hand[index];

        const cardSlotSizer = cn(
          "relative",
          cardSize === "xxs" && "h-16 w-12",
          cardSize === "xs" && "h-22 w-16",
          cardSize === "sm" && "h-28 w-20",
          cardSize === "md" && "h-36 w-24",
          cardSize === "lg" && "h-40 w-28",
        );

        // If there's no card at this index (e.g., hand has 3 cards, but we're rendering the 4th slot),
        // render an empty placeholder to maintain grid structure.
        if (!card) {
          return (
            <div
              key={`empty-slot-${ownerId}-${index}`}
              className={cardSlotSizer}
            />
          );
        }

        const isCardVisible = visibleCards.some(
          (vc) => vc.playerId === ownerId && vc.cardIndex === index,
        );

        // If the original card lacks rank info (facedown) but we have a visible version, replace it
        const visibleCardData = isCardVisible
          ? visibleCards.find(
              (vc) => vc.playerId === ownerId && vc.cardIndex === index,
            )?.card
          : undefined;

        const cardToRender = (
          "rank" in card ? card : (visibleCardData ?? card)
        ) as PublicCard;

        const isFaceUp = "rank" in cardToRender;

        const isMatchSelected = selectedCardIndices.includes(index);
        const isAbilityPeekSelected =
          abilitySelectionInfo.stage === "peeking" &&
          abilitySelectionInfo.selectedPeekTargets.some(
            (t) => t.playerId === ownerId && t.cardIndex === index,
          );
        const isAbilitySwapSelected =
          abilitySelectionInfo.stage === "swapping" &&
          abilitySelectionInfo.selectedSwapTargets.some(
            (t) => t.playerId === ownerId && t.cardIndex === index,
          );
        const abilityRingClass = isAbilityPeekSelected
          ? "ring-yellow-300/70"
          : isAbilitySwapSelected
            ? "ring-pink-400/70"
            : "";
        const isSelected =
          isMatchSelected || isAbilityPeekSelected || isAbilitySwapSelected;

        return (
          // This div acts as the stable grid cell.
          <div key={`slot-${ownerId}-${index}`} className={cardSlotSizer}>
            <AnimatePresence>
              {card && (
                // This motion.div animates within the stable slot.
                <motion.div
                  key={card.id}
                  layoutId={card.id}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className={cn(
                    "absolute inset-0", // Positioned absolutely within the parent slot
                    canInteract && "cursor-pointer",
                    canInteract && "hover:brightness-110",
                  )}
                  onClick={() => canInteract && onCardClick?.(card, index)}
                  whileHover={
                    canInteract
                      ? {
                          y: -8,
                          scale: 1.05,
                          filter: "brightness(1.15)",
                        }
                      : {}
                  }
                >
                  {/* Animated selection ring */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        key="sel-ring"
                        className={cn(
                          "absolute inset-0.5 rounded-md pointer-events-none",
                          "ring-[4px]",
                          isMatchSelected
                            ? "ring-sky-400/80"
                            : abilityRingClass,
                        )}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                      />
                    )}
                  </AnimatePresence>
                  <PlayingCard
                    card={isFaceUp ? (cardToRender as any) : undefined}
                    faceDown={!isFaceUp}
                    className="card-fluid"
                    size={cardSize}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};
