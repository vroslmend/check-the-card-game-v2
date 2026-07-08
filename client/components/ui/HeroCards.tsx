"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { Suit, CardRank, type Card } from "shared-types";

// A hand of four on the table. The cards deal themselves in on load, breathe
// while idle, and every few seconds sneak a look at the bottom two — the
// game's initial-peek gesture. Hovering "Check" in the headline spreads the
// fan and shows the same peek deliberately.
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

const PEEK_EVERY_MS = 7000;
const PEEK_HOLD_MS = 1600;

export function HeroCards({ checkHovered }: { checkHovered: boolean }) {
  const reduced = useReducedMotion();
  const [dealt, setDealt] = useState(false);
  const [autoPeek, setAutoPeek] = useState(false);
  const [cardsHovered, setCardsHovered] = useState(false);

  // Hovering "Check" in the headline OR the cards themselves spreads the fan.
  const hovered = checkHovered || cardsHovered;

  // Entrance: the fan deals itself in once, card by card.
  useEffect(() => {
    const t = setTimeout(() => setDealt(true), 1400);
    return () => clearTimeout(t);
  }, []);

  // Idle life: a periodic peek at the bottom two, paused while hovered.
  useEffect(() => {
    if (reduced || hovered) {
      setAutoPeek(false);
      return;
    }
    let hold: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setAutoPeek(true);
      hold = setTimeout(() => setAutoPeek(false), PEEK_HOLD_MS);
    }, PEEK_EVERY_MS);
    return () => {
      clearInterval(interval);
      if (hold) clearTimeout(hold);
    };
  }, [reduced, hovered]);

  // Reduced motion: rest in the spread pose with the two faces showing.
  const spread = hovered || !!reduced;
  const peeking = spread || autoPeek;

  return (
    <div
      className="relative flex h-96 w-96 items-center justify-center"
      onMouseEnter={() => setCardsHovered(true)}
      onMouseLeave={() => setCardsHovered(false)}
      aria-hidden
    >
      {HAND.map((card, i) => {
        const p = POSES[i]!;
        return (
          <motion.div
            key={card.id}
            className="absolute h-56 w-40"
            initial={
              reduced
                ? false
                : { x: p.x, y: p.y - 48, rotate: 0, opacity: 0 }
            }
            animate={{
              x: spread ? p.x * 1.6 : p.x,
              y: spread ? p.y - 10 : p.y,
              rotate: spread ? p.spread : p.rest,
              opacity: 1,
            }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 22,
              delay: dealt ? 0 : 0.35 + i * 0.12,
            }}
          >
            <motion.div
              className="h-full w-full"
              animate={reduced ? { y: 0 } : { y: [0, -4, 0] }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      duration: 4.5 + i * 0.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1.8 + i * 0.45,
                    }
              }
            >
              <PlayingCard
                card={card}
                faceDown={!(peeking && p.flips)}
                className="h-full w-full"
              />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
