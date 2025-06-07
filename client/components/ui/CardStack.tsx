"use client"

import { motion, useTransform, MotionValue } from "framer-motion"

const cards = [0, 1, 2];

export function CardStack({ continuousActiveCard }: { continuousActiveCard: MotionValue<number> }) {
  return (
    <motion.div
      style={{ perspective: "1000px" }}
      className="relative h-60 w-80"
    >
      {cards.map(cardIndex => (
        <Card
          key={cardIndex}
          cardIndex={cardIndex}
          continuousActiveCard={continuousActiveCard}
        />
      ))}
    </motion.div>
  )
}

function Card({ cardIndex, continuousActiveCard }: { cardIndex: number; continuousActiveCard: MotionValue<number> }) {
  const diff = useTransform(continuousActiveCard, (latest) => cardIndex - latest);

  const y = useTransform(diff, [-1, 0, 1, 2], [-50, 0, 12, 24]);
  const scale = useTransform(diff, [-1, 0, 1], [0.85, 1, 0.9]);
  const opacity = useTransform(diff, [-1, -0.2, 0.5, 1.2], [0, 1, 1, 0]);
  const rotateX = useTransform(diff, [-1, 0], [45, 0]);
  const zIndex = useTransform(diff, (v) => cards.length - Math.abs(Math.round(v)));

  return (
    <motion.div
      style={{
        y,
        scale,
        opacity,
        rotateX,
        zIndex,
        transformOrigin: "bottom center",
        transformStyle: "preserve-3d",
      }}
      className="absolute h-full w-full rounded-2xl bg-gradient-to-br from-stone-200 to-stone-300 p-4 dark:from-stone-800 dark:to-stone-900 shadow-xl"
    >
      <div className="h-full w-full rounded-lg border-2 border-stone-300/50 dark:border-stone-700/50" />
    </motion.div>
  )
}
