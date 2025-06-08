"use client"

import { motion, useTransform, MotionValue } from "framer-motion"
import { LucideIcon } from "lucide-react"

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const cardColors = [
  "from-red-200 to-red-300 dark:from-red-800 dark:to-red-900",
  "from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900",
  "from-green-200 to-green-300 dark:from-green-800 dark:to-green-900",
];

export function CardStack({
  features,
  continuousActiveCard,
  cardEntryProgress,
}: {
  features: Feature[];
  continuousActiveCard: MotionValue<number>;
  cardEntryProgress: MotionValue<number>;
}) {
  const colorOpacities = cardColors.map((_, index) =>
    useTransform(continuousActiveCard, (latest) => {
      const diff = Math.abs(index - latest);
      return Math.max(1 - diff, 0);
    })
  );

  return (
    <motion.div
      style={{ perspective: "1000px" }}
      className="relative h-96 w-full"
    >
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        {cardColors.map((color, index) => (
          <motion.div
            key={color}
            style={{ opacity: colorOpacities[index] }}
            className={`absolute inset-0 bg-gradient-to-br ${color}`}
          />
        ))}
      </div>

      {features.map((feature, cardIndex) => (
        <Card
          key={cardIndex}
          feature={feature}
          cardIndex={cardIndex}
          totalCards={features.length}
          continuousActiveCard={continuousActiveCard}
          cardEntryProgress={cardEntryProgress}
        />
      ))}
    </motion.div>
  )
}

function Card({
  feature,
  cardIndex,
  totalCards,
  continuousActiveCard,
  cardEntryProgress,
}: {
  feature: Feature;
  cardIndex: number;
  totalCards: number;
  continuousActiveCard: MotionValue<number>;
  cardEntryProgress: MotionValue<number>;
}) {
  const diff = useTransform(continuousActiveCard, (latest) => cardIndex - latest);

  const stackY = useTransform(diff, [-1, 0, 1, 2], [-50, 0, 12, 24]);
  const entryY = useTransform(cardEntryProgress, [0, 1], [50, 0]);
  const y = useTransform([stackY, entryY], (values: number[]) => values[0] + values[1]);

  const stackOpacity = useTransform(diff, [-1, -0.2, 0.5, 1.2], [0, 1, 1, 0]);
  const entryOpacity = useTransform(cardEntryProgress, [0.5, 1], [0, 1]);
  const opacity = useTransform([stackOpacity, entryOpacity], (values: number[]) => values[0] * values[1]);

  const scale = useTransform(diff, [-1, 0, 1], [0.85, 1, 0.9]);
  const rotateX = useTransform(diff, [-1, 0], [45, 0]);
  const zIndex = useTransform(diff, (v) => totalCards - Math.abs(Math.round(v)));
  const Icon = feature.icon;

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
      className={`absolute h-full w-full rounded-2xl bg-transparent p-4 shadow-xl flex flex-col items-center justify-center`}
    >
      <Icon className="h-16 w-16 text-white/80 mb-4" />
      <h3 className="text-2xl font-light text-white">{feature.title}</h3>
    </motion.div>
  )
}
