"use client"

import { AnimatePresence, motion } from "framer-motion"

const cardVariants = {
  initial: (i: number) => ({
    y: i * 8,
    scale: 1 - i * 0.05,
    zIndex: 3 - i,
    opacity: 0,
  }),
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -20,
    transition: { duration: 0.2 },
  },
  hover: {
    y: -10,
    scale: 1.05,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
}

export function CardStack({ activeCard }: { activeCard: number }) {
  const cards = [0, 1, 2] // Represents the three cards

  return (
    <div style={{ perspective: "1000px" }} className="relative h-48 w-72">
      <AnimatePresence>
        {cards
          .filter(i => i === activeCard)
          .map(i => (
            <motion.div
              key={i}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              whileHover="hover"
              custom={i}
              className="absolute h-full w-full rounded-2xl bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-800 dark:to-stone-900 shadow-lg"
            />
          ))}
      </AnimatePresence>
    </div>
  )
} 