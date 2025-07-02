"use client";

import { motion, useTransform, MotionValue } from "framer-motion";
import React from "react";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const cardColors = [
  "from-stone-200 to-stone-300 dark:from-zinc-800 dark:to-zinc-700",
  "from-stone-300 to-stone-400 dark:from-zinc-700 dark:to-zinc-600",
  "from-stone-400 to-stone-500 dark:from-zinc-600 dark:to-zinc-500",
];

export function CardStack({ features }: { features: Feature[] }) {
  return (
    <div style={{ perspective: "1000px" }} className="relative h-96 w-full">
      {features.map((feature, cardIndex) => (
        <Card
          key={cardIndex}
          feature={feature}
          cardIndex={cardIndex}
          totalCards={features.length}
        />
      ))}
    </div>
  );
}

function Card({
  feature,
  cardIndex,
  totalCards,
}: {
  feature: Feature;
  cardIndex: number;
  totalCards: number;
}) {
  const y = cardIndex * 12;
  const scale = 1 - (totalCards - 1 - cardIndex) * 0.05;
  const zIndex = totalCards - cardIndex;
  const Icon = feature.icon;

  return (
    <motion.div
      style={{
        y,
        scale,
        zIndex,
        transformOrigin: "bottom center",
      }}
      className={`absolute h-full w-full rounded-2xl bg-gradient-to-br ${cardColors[cardIndex % cardColors.length]} p-4 shadow-xl flex flex-col items-center justify-center`}
    >
      <div className="bg-white/20 dark:bg-black/20 backdrop-blur-sm p-4 rounded-full">
        <Icon className="h-12 w-12 text-stone-900 dark:text-stone-100" />
      </div>
      <h3 className="text-2xl font-serif mt-4 text-stone-900 dark:text-stone-100">
        {feature.title}
      </h3>
    </motion.div>
  );
}
