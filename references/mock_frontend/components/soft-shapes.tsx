"use client"

import { motion } from "framer-motion"

interface SoftShapesProps {
  mousePosition: { x: number; y: number }
  scrollY: any
}

export function SoftShapes({ mousePosition, scrollY }: SoftShapesProps) {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* Large soft shape */}
      <motion.div
        style={{ y: scrollY }}
        className="absolute -right-1/4 top-1/4 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-stone-200/40 to-stone-300/40 blur-3xl dark:from-stone-800/40 dark:to-stone-900/40"
        animate={{
          x: mousePosition.x * 50,
          y: mousePosition.y * 30,
          scale: [1, 1.1, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 50, damping: 30 },
          y: { type: "spring", stiffness: 50, damping: 30 },
          scale: { duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
        }}
      />

      {/* Medium soft shape */}
      <motion.div
        style={{ y: scrollY }}
        className="absolute -left-1/4 bottom-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-stone-100/30 to-stone-200/30 blur-2xl dark:from-stone-900/30 dark:to-stone-800/30"
        animate={{
          x: mousePosition.x * -30,
          y: mousePosition.y * -20,
          scale: [1, 0.9, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 40, damping: 25 },
          y: { type: "spring", stiffness: 40, damping: 25 },
          scale: { duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
        }}
      />

      {/* Small accent shapes */}
      <motion.div
        className="absolute right-1/3 top-1/3 h-[300px] w-[300px] rounded-full bg-gradient-to-bl from-stone-300/20 to-stone-400/20 blur-xl dark:from-stone-700/20 dark:to-stone-600/20"
        animate={{
          x: mousePosition.x * 20,
          y: mousePosition.y * 15,
          rotate: [0, 180, 360],
        }}
        transition={{
          x: { type: "spring", stiffness: 60, damping: 20 },
          y: { type: "spring", stiffness: 60, damping: 20 },
          rotate: { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
        }}
      />
    </div>
  )
}
