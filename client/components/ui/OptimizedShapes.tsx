"use client"

import { motion, useTransform, useSpring, type MotionValue } from "framer-motion"
import { useMemo } from "react"

interface OptimizedShapesProps {
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
  scrollY: MotionValue<string>
}

export function OptimizedShapes({ mouseX, mouseY, scrollY }: OptimizedShapesProps) {
  // Pre-calculate transforms to avoid recalculation
  const smoothMouseX = useSpring(mouseX, { stiffness: 100, damping: 30 })
  const smoothMouseY = useSpring(mouseY, { stiffness: 100, damping: 30 })

  const shape1X = useTransform(smoothMouseX, [-1, 1], [-90, 90])
  const shape1Y = useTransform(smoothMouseY, [-1, 1], [-60, 60])

  const shape2X = useTransform(smoothMouseX, [-1, 1], [60, -60])
  const shape2Y = useTransform(smoothMouseY, [-1, 1], [45, -45])

  const shape3X = useTransform(smoothMouseX, [-1, 1], [-45, 45])
  const shape3Y = useTransform(smoothMouseY, [-1, 1], [-30, 30])

  // Memoize shape configurations to prevent unnecessary re-renders
  const shapes = useMemo(
    () => [
      {
        id: 1,
        className:
          "absolute -right-1/4 top-1/4 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-stone-200/30 to-stone-300/30 blur-3xl dark:from-stone-800/30 dark:to-stone-900/30",
        x: shape1X,
        y: shape1Y,
        scale: [1, 1.05, 1],
        duration: 12,
      },
      {
        id: 2,
        className:
          "absolute -left-1/4 bottom-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-stone-100/25 to-stone-200/25 blur-2xl dark:from-stone-900/25 dark:to-stone-800/25",
        x: shape2X,
        y: shape2Y,
        scale: [1, 0.95, 1],
        duration: 10,
      },
      {
        id: 3,
        className:
          "absolute right-1/3 top-1/3 h-[300px] w-[300px] rounded-full bg-gradient-to-bl from-stone-300/15 to-stone-400/15 blur-xl dark:from-stone-700/15 dark:to-stone-600/15",
        x: shape3X,
        y: shape3Y,
        scale: [1, 1.1, 1],
        duration: 8,
      },
    ],
    [shape1X, shape1Y, shape2X, shape2Y, shape3X, shape3Y],
  )

  return (
    <div className="fixed inset-0 z-0 overflow-hidden will-change-transform pointer-events-none">
      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          style={{
            y: scrollY,
            x: shape.x,
            translateY: shape.y,
            willChange: "transform",
          }}
          className={shape.className}
          animate={{
            scale: shape.scale,
          }}
          transition={{
            scale: {
              duration: shape.duration,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            },
          }}
        />
      ))}
    </div>
  )
} 