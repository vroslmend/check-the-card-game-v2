"use client"

import { motion } from "framer-motion"
import { Spade, Heart, Diamond, Club } from "lucide-react"

interface FloatingElementsProps {
  mousePosition: { x: number; y: number }
  isVisible: boolean
}

export function FloatingElements({ mousePosition, isVisible }: FloatingElementsProps) {
  const suits = [Spade, Heart, Diamond, Club]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.8,
      }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="relative h-full w-full"
    >
      {/* Central elegant shape */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-gradient-to-br from-stone-200/60 to-stone-300/60 backdrop-blur-sm dark:from-stone-800/60 dark:to-stone-900/60"
        animate={{
          rotateX: mousePosition.y * 10,
          rotateY: mousePosition.x * 10,
          scale: [1, 1.05, 1],
        }}
        transition={{
          rotateX: { type: "spring", stiffness: 100, damping: 30 },
          rotateY: { type: "spring", stiffness: 100, damping: 30 },
          scale: { duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
        }}
        style={{ perspective: "1000px" }}
      />

      {/* Floating card suits */}
      {suits.map((Icon, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{
            left: `${30 + (index % 2) * 40}%`,
            top: `${20 + Math.floor(index / 2) * 60}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ delay: 0.5 + index * 0.2, duration: 0.8 }}
        >
          <motion.div
            animate={{
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 4 + index,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/40 backdrop-blur-sm dark:bg-stone-900/40"
          >
            <Icon className="h-8 w-8 text-stone-700 dark:text-stone-300" />
          </motion.div>
        </motion.div>
      ))}

      {/* Subtle particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-stone-400/40 dark:bg-stone-600/40"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 3 + i,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
        />
      ))}
    </motion.div>
  )
}
