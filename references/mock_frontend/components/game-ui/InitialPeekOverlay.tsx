"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "./Card"
import { Eye } from "lucide-react"

interface InitialPeekOverlayProps {
  cards: any[]
  onComplete: () => void
}

export function InitialPeekOverlay({ cards, onComplete }: InitialPeekOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-stone-200/20 bg-stone-50/95 p-8 shadow-2xl backdrop-blur-xl dark:border-stone-800/20 dark:bg-stone-900/95"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 400 }}
        >
          <div className="text-center mb-6">
            <motion.div
              className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Eye className="h-8 w-8 text-stone-700 dark:text-stone-300" />
            </motion.div>
            <h2 className="text-2xl font-serif font-light text-stone-900 dark:text-stone-100">Initial Peek</h2>
            <p className="text-sm font-light text-stone-600 dark:text-stone-400 mt-2">
              Memorize your bottom two cards (positions 2 & 3)
            </p>
          </div>

          <motion.div
            className="flex gap-4 justify-center mb-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.2,
                  delayChildren: 0.3,
                },
              },
            }}
          >
            {cards.map((card, index) => (
              <motion.div
                key={card.id}
                variants={{
                  hidden: { opacity: 0, y: 20, rotateY: -90 },
                  visible: { opacity: 1, y: 0, rotateY: 0 },
                }}
                transition={{ duration: 0.6, type: "spring", stiffness: 150 }}
              >
                <div className="relative">
                  <Card card={card} canInteract={false} layoutId={`peek-${card.id}`} size="lg" />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                    {card.position}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <Button
              onClick={onComplete}
              className="w-full h-12 rounded-2xl bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-sm font-light"
            >
              Continue to Play Phase
            </Button>
          </motion.div>

          <motion.p
            className="text-center text-xs font-light text-stone-600 dark:text-stone-400 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            Remember: These cards will be face-down during play
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
