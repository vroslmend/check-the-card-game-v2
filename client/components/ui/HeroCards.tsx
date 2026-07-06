"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { Suit, CardRank, type Card } from "shared-types";

// A hand of four on the table — facedown accent backs at rest; hovering
// "Check" in the headline spreads the fan and flips the bottom two, the
// game's own initial-peek gesture. Pure presentation.
const HAND: Card[] = [
  { id: "hero-1", suit: Suit.Spades, rank: CardRank.Ace },
  { id: "hero-2", suit: Suit.Hearts, rank: CardRank.King },
  { id: "hero-3", suit: Suit.Clubs, rank: CardRank.Seven },
  { id: "hero-4", suit: Suit.Diamonds, rank: CardRank.Two },
];

const POSES = [
  { x: -66, y: 6, rest: -8, spread: -14, flips: false },
  { x: -22, y: 0, rest: -3, spread: -5, flips: false },
  { x: 22, y: 0, rest: 3, spread: 5, flips: true },
  { x: 66, y: 6, rest: 8, spread: 14, flips: true },
];

export function HeroCards({ checkHovered }: { checkHovered: boolean }) {
  const reduced = useReducedMotion();
  // Reduced motion: rest in the spread pose with the two faces showing.
  const spread = checkHovered || !!reduced;

  return (
    <div
      className="relative flex h-96 w-96 items-center justify-center"
      aria-hidden
    >
      {HAND.map((card, i) => {
        const p = POSES[i]!;
        return (
          <motion.div
            key={card.id}
            className="absolute h-56 w-40"
            initial={false}
            animate={{
              x: spread ? p.x * 1.6 : p.x,
              y: spread ? p.y - 10 : p.y,
              rotate: spread ? p.spread : p.rest,
            }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            <PlayingCard
              card={card}
              faceDown={!(spread && p.flips)}
              className="h-full w-full"
            />
          </motion.div>
        );
      })}
    </div>
  );
}
