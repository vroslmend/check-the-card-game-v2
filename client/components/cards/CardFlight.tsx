"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentProps } from "react";
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
  // Backstop: Gecko occasionally drops onLayoutAnimationComplete when a
  // flight is interrupted, which left cards stuck at the lift pose. Clear
  // the lift shortly after the 0.65s travel tween even if the callback
  // never arrives.
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clearRef.current) clearTimeout(clearRef.current);
    },
    [],
  );
  const liftOn = () => {
    if (clearRef.current) clearTimeout(clearRef.current);
    setInFlight(true);
    clearRef.current = setTimeout(() => setInFlight(false), 900);
  };
  const liftOff = () => {
    if (clearRef.current) clearTimeout(clearRef.current);
    setInFlight(false);
  };
  return (
    <motion.div
      {...rest}
      style={{ ...style, zIndex: inFlight ? 40 : undefined }}
      transition={{ ...cardTravelTransition, ...transition }}
      onLayoutAnimationStart={liftOn}
      onLayoutAnimationComplete={liftOff}
      animate={{
        scale: inFlight ? CARD_LIFT_SCALE : 1,
        boxShadow: inFlight ? CARD_LIFT_SHADOW : CARD_REST_SHADOW,
      }}
    />
  );
}
