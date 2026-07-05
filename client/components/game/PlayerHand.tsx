"use client";

import React from "react";
import { useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext";
import { HandGrid } from "./HandGrid";
import { type Player, type Card, GameStage } from "shared-types";
import { cn } from "@/lib/utils";
import { PlayingCard } from "../cards/PlayingCard";
import { CardFlight } from "../cards/CardFlight";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Eye, ArrowLeftRight, type LucideIcon } from "lucide-react";

/** Corner badge on a ringed card slot: surface chip, ink glyph. The icon
 *  distinguishes the action (eye = peek, arrows = swap); the ring color says
 *  whose it is (accent = yours, ink = informational). */
const SlotBadge = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className="absolute -top-2 -right-2 rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm">
    <Icon className="h-3 w-3" />
  </span>
);

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
    publicSwap: state.context.currentGameState?.publicSwap ?? null,
    serverClockOffset: state.context.serverClockOffset,
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
    publicSwap,
    serverClockOffset,
    localPlayerId,
    gameStage,
  } = useUISelector(selectContext);
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");

  // publicSwap is a momentary flash: show the rings for a few seconds after
  // the swap, then drop them without waiting for a server clear. occurredAt
  // is a SERVER timestamp — compare on the server's clock (via the tracked
  // offset), otherwise a client whose clock runs ahead computes remaining<=0
  // and never shows the ring at all (the "sometimes it works" bug).
  const SWAP_RING_VISIBLE_MS = 4000;
  const [expiredSwapAt, setExpiredSwapAt] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!publicSwap) return;
    const remaining =
      publicSwap.occurredAt +
      SWAP_RING_VISIBLE_MS -
      (Date.now() + serverClockOffset);
    if (remaining <= 0) {
      setExpiredSwapAt(publicSwap.occurredAt);
      return;
    }
    const t = setTimeout(
      () => setExpiredSwapAt(publicSwap.occurredAt),
      remaining,
    );
    return () => clearTimeout(t);
  }, [publicSwap, serverClockOffset]);
  const swapIndicatorLive =
    !!publicSwap && expiredSwapAt !== publicSwap.occurredAt;

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

        // Someone else's just-confirmed ability swap touched this slot —
        // everyone sees WHICH two cards traded places, never their faces.
        const showSwapIndicator =
          swapIndicatorLive &&
          publicSwap!.swapperId !== localPlayerId &&
          publicSwap!.targets.some(
            (t) => t.playerId === player.id && t.cardIndex === index,
          );

        return (
          <div
            key={card.id}
            className="relative w-[min(8vh,15vw)] aspect-[5/7]"
          >
            <CardFlight
              key={card.id}
              layoutId={card.id}
              className={cn(
                "absolute inset-0 rounded-lg",
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
                {/* Your own selection — accent ring; the badge icon (eye vs
                    arrows) says which action, never the hue. */}
                {isSelected && (
                  <motion.div
                    key="sel-ring"
                    className="absolute inset-0.5 rounded-md pointer-events-none z-20 ring-[3px] ring-accent"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    {isAbilityPeekSelected && <SlotBadge icon={Eye} />}
                    {isAbilitySwapSelected && <SlotBadge icon={ArrowLeftRight} />}
                  </motion.div>
                )}
                {/* Someone else's peek — informational ink ring + eye badge. */}
                {showPeekIndicator && (
                  <motion.div
                    key="peek-indicator"
                    className="absolute inset-0.5 rounded-md pointer-events-none z-20 ring-[2px] ring-ink"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <SlotBadge icon={Eye} />
                  </motion.div>
                )}
                {/* Someone else's swap — informational ink ring + arrows badge. */}
                {showSwapIndicator && (
                  <motion.div
                    key="swap-indicator"
                    className="absolute inset-0.5 rounded-md pointer-events-none z-20 ring-[2px] ring-ink"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <SlotBadge icon={ArrowLeftRight} />
                  </motion.div>
                )}
              </AnimatePresence>
              <PlayingCard
                card={isFaceUp ? (cardToRender as Card) : undefined}
                faceDown={!isFaceUp}
                className="h-full w-full"
              />
            </CardFlight>
          </div>
        );
      })}
    </HandGrid>
  );
};

export default PlayerHand;
