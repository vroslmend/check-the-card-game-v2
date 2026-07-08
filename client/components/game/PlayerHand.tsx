"use client";

import React from "react";
import { useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext";
import { HandGrid } from "./HandGrid";
import { type Player, type Card, GameStage } from "shared-types";
import { cn } from "@/lib/utils";
import { PlayingCard } from "../cards/PlayingCard";
import { CardFlight } from "../cards/CardFlight";
import { CARD_RING_GEOMETRY } from "../cards/cardRing";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Eye, ArrowLeftRight, Equal, type LucideIcon } from "lucide-react";

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
  /** Position around the table; staggers the end-of-round reveal and the
   *  deal ripple. */
  tableIndex: number;
  /** Dense seat: smaller cells and tighter grid, so a full table of
   *  opponents fits a phone. The local player's own hand stays regular. */
  dense?: boolean;
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
  tableIndex,
  dense = false,
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

  // SCORING/GAMEOVER broadcasts reveal every hand; the reveal now happens ON
  // the table — cards flip in place in a ripple (tableIndex*180 +
  // cardIndex*60ms) after the 1.1s settle hold, replacing the old sheet's
  // RevealCard cascade.
  const isEndStage =
    gameStage === GameStage.SCORING || gameStage === GameStage.GAMEOVER;
  const reducedMotion = !!useReducedMotion();
  const [revealed, setRevealed] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  React.useEffect(() => {
    if (!isEndStage) {
      setRevealed(new Set());
      return;
    }
    if (reducedMotion) {
      setRevealed(new Set(player.hand.map((_, i) => i)));
      return;
    }
    const timers = player.hand.map((_, i) =>
      setTimeout(
        () =>
          setRevealed((prev) => {
            const next = new Set(prev);
            next.add(i);
            return next;
          }),
        1100 + tableIndex * 180 + i * 60,
      ),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEndStage, reducedMotion, player.hand.length, tableIndex]);

  // Deal ripple: only the commit that swaps DEALING -> INITIAL_PEEK mounts
  // the hand cells, and only that commit gets per-card layout delays (a
  // dealer's sweep: tableIndex*80 + cardIndex*40ms). Interrupted flights
  // never carry a delay — the R11 projection-timing concern (findings §5.4)
  // applied to delays on live flights, not on mount-time ones; the WAAPI
  // class itself was closed by motion 12.42.2.
  const prevStageRef = React.useRef(gameStage);
  const dealtThisCommit =
    prevStageRef.current === GameStage.DEALING &&
    gameStage === GameStage.INITIAL_PEEK;
  React.useEffect(() => {
    prevStageRef.current = gameStage;
  });

  const handToDisplay =
    isLocalPlayer && !isEndStage
      ? player.hand.map((card) =>
          card === null ? null : { facedown: true as const, id: card.id },
        )
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

  const combinedClass = cn(isLocked && "opacity-60", dense && "gap-1");

  return (
    <HandGrid numItems={handToDisplay.length} className={combinedClass}>
      {displayEntries.map(({ card, index }) => {
        // An empty slot: a hairline-outlined placeholder, no card, no motion,
        // keyed by position so it never animates and never takes a click.
        if (card === null) {
          return (
            <div
              key={`slot-${index}`}
              aria-hidden
              className={cn(
                "relative aspect-[5/7]",
                dense
                  ? "w-[min(8svh,11.5vw,3.5rem)] @4xl:w-[min(8svh,11.5vw)]"
                  : "w-[min(8svh,15vw)]",
              )}
            >
              <div className="absolute inset-0 rounded-card border border-hairline" />
            </div>
          );
        }

        const isCardVisible = visibleCards.some(
          (vc) => vc.playerId === player.id && vc.cardIndex === index,
        );

        const visibleCardData = isCardVisible
          ? visibleCards.find(
              (vc) => vc.playerId === player.id && vc.cardIndex === index,
            )?.card
          : undefined;

        let cardToRender: Card | { facedown: true; id: string } = card;

        if (isCardVisible) {
          cardToRender = visibleCardData || player.hand[index]!;
        }
        const isFaceUp =
          "rank" in cardToRender && (!isEndStage || revealed.has(index));

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
            className={cn(
              "relative aspect-[5/7]",
              // svh, not vh: stable while mobile browser chrome collapses.
              // Dense cells trade size for fitting six seats on a phone —
              // their taps are occasional (ability targeting), not constant.
              // The 3.5rem cap is for mid-width portrait tablets; at @4xl a
              // full row fits anyway and the cap lifts, so desktop and
              // half-screen sizes are unchanged.
              dense
                ? "w-[min(8svh,11.5vw,3.5rem)] @4xl:w-[min(8svh,11.5vw)]"
                : "w-[min(8svh,15vw)]",
            )}
          >
            {/* No whileHover here: this is the layoutId projection node, and
                a hover pose on it fights the flight projection for the same
                transform (the Gecko skip/stuck-pose class). The brightness
                cue in the classes is the hover feedback. */}
            <CardFlight
              key={card.id}
              layoutId={card.id}
              transition={
                dealtThisCommit && !reducedMotion
                  ? {
                      layout: {
                        type: "tween",
                        duration: 0.65,
                        ease: [0.55, 0.06, 0.19, 0.98],
                        delay: (tableIndex * 80 + index * 40) / 1000,
                      },
                    }
                  : undefined
              }
            className={cn(
              "absolute inset-0 rounded-card",
              "data-[interactive=true]:cursor-pointer",
              "data-[interactive=true]:hover:filter-[brightness(1.15)]",
            )}
              data-interactive={canInteract && !isLocked}
              onClick={() => canInteract && !isLocked && onCardClick?.(index)}
            >
              <AnimatePresence>
                {/* Your own selection — accent ring; the badge icon (eye =
                    peek, arrows = swap, equals = match) says which action,
                    never the hue. */}
                {isSelected && (
                  <motion.div
                    key="sel-ring"
                    className={cn(CARD_RING_GEOMETRY, "ring-[3px] ring-accent")}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    {isMatchSelected && <SlotBadge icon={Equal} />}
                    {isAbilityPeekSelected && <SlotBadge icon={Eye} />}
                    {isAbilitySwapSelected && <SlotBadge icon={ArrowLeftRight} />}
                  </motion.div>
                )}
                {/* Someone else's peek — informational ink ring + eye badge. */}
                {showPeekIndicator && (
                  <motion.div
                    key="peek-indicator"
                    className={cn(CARD_RING_GEOMETRY, "ring-[2px] ring-ink")}
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
                    className={cn(CARD_RING_GEOMETRY, "ring-[2px] ring-ink")}
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
