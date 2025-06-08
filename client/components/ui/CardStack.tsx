"use client"

import { motion, useTransform, MotionValue } from "framer-motion"
import { Spade, Clapperboard, Zap } from "lucide-react"

const cards = [
  {
    icon: Spade,
    title: "Seamless UI",
    bgColor: "from-red-200 to-red-300 dark:from-red-800 dark:to-red-900",
  },
  {
    icon: Clapperboard,
    title: "Fluid Animations",
    bgColor: "from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900",
  },
  {
    icon: Zap,
    title: "Haptic Feedback",
    bgColor: "from-green-200 to-green-300 dark:from-green-800 dark:to-green-900",
  },
];

export function CardStack({ continuousActiveCard }: { continuousActiveCard: MotionValue<number> }) {
  return (
    <motion.div
      style={{ perspective: "1000px" }}
      className="relative h-96 w-full"
    >
      {cards.map((card, cardIndex) => (
        <Card
          key={cardIndex}
          card={card}
          cardIndex={cardIndex}
          continuousActiveCard={continuousActiveCard}
        />
      ))}
    </motion.div>
  )
}

function Card({ card, cardIndex, continuousActiveCard }: { card: typeof cards[0], cardIndex: number; continuousActiveCard: MotionValue<number> }) {
  const diff = useTransform(continuousActiveCard, (latest) => cardIndex - latest);

  const y = useTransform(diff, [-1, 0, 1, 2], [-50, 0, 12, 24]);
  const scale = useTransform(diff, [-1, 0, 1], [0.85, 1, 0.9]);
  const opacity = useTransform(diff, [-1, -0.2, 0.5, 1.2], [0, 1, 1, 0]);
  const rotateX = useTransform(diff, [-1, 0], [45, 0]);
  const zIndex = useTransform(diff, (v) => cards.length - Math.abs(Math.round(v)));
  const Icon = card.icon;

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
      className={`absolute h-full w-full rounded-2xl bg-gradient-to-br ${card.bgColor} p-4 shadow-xl flex flex-col items-center justify-center`}
    >
      <Icon className="h-16 w-16 text-white/50 mb-4" />
      <h3 className="text-2xl font-light text-white/80">{card.title}</h3>
    </motion.div>
  )
}
