"use client"

import { motion, type MotionValue } from "framer-motion"
import { ElementType } from "react"

interface FloatingSuitIconProps {
  Icon: ElementType
  animation: any
  duration: number
  isCheckHovered: boolean
}

export function FloatingSuitIcon({ Icon, animation, duration, isCheckHovered }: FloatingSuitIconProps) {
  const variants = {
    normal: {
      y: animation.y,
      rotate: animation.rotate,
      scale: animation.scale,
      boxShadow: "0 0 0px rgba(235, 235, 235, 0)",
    },
    glow: {
      y: animation.y,
      rotate: animation.rotate,
      scale: (animation.scale as number[]).map(s => s * 1.1),
      boxShadow: "0 0 25px rgba(235, 235, 235, 0.8)",
    },
  }

  return (
    <motion.div
      variants={variants}
      animate={isCheckHovered ? "glow" : "normal"}
      transition={{
        y: { duration, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration, repeat: Infinity, ease: "easeInOut" },
        scale: { duration, repeat: Infinity, ease: "easeInOut" },
        boxShadow: { duration: 0.5, ease: "easeOut", delay: isCheckHovered ? 0.8 : 0 },
      }}
      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/30 backdrop-blur-sm transition-colors duration-300 hover:bg-white/50 dark:bg-stone-900/30 dark:hover:bg-stone-900/50"
      whileHover={{
        scale: 1.1,
        transition: { duration: 0.2 },
      }}
    >
      <Icon className="h-8 w-8 text-stone-700 dark:text-stone-300" />
    </motion.div>
  )
} 