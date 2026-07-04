"use client";

import { motion } from "framer-motion";
import { useState, type ComponentProps } from "react";
import {
  cardTravelTransition,
  CARD_LIFT_SCALE,
  CARD_LIFT_SHADOW,
  CARD_REST_SHADOW,
} from "@/lib/card-motion";

type CardFlightProps = ComponentProps<typeof motion.div>;

/**
 * layoutId wrapper for cards that travel between board positions: applies
 * the shared lift-travel-place layout easing and, while the layout
 * animation runs, lifts the card (scale + shadow + z-index) so moves read
 * like a hand physically carrying the card. Grid-reflow shifts (e.g. a
 * penalty card widening the hand) also trigger a small lift on neighbours —
 * acceptable: they visibly "make room".
 */
export function CardFlight({ style, transition, ...rest }: CardFlightProps) {
  const [inFlight, setInFlight] = useState(false);
  return (
    <motion.div
      {...rest}
      style={{ ...style, zIndex: inFlight ? 40 : undefined }}
      transition={{ ...cardTravelTransition, ...transition }}
      onLayoutAnimationStart={() => setInFlight(true)}
      onLayoutAnimationComplete={() => setInFlight(false)}
      animate={{
        scale: inFlight ? CARD_LIFT_SCALE : 1,
        boxShadow: inFlight ? CARD_LIFT_SHADOW : CARD_REST_SHADOW,
      }}
    />
  );
}
