"use client"

import { motion, useTransform, useSpring, type MotionValue } from "framer-motion"
import { Spade, Heart, Diamond, Club } from "lucide-react"
import { useMemo } from "react"

interface SmoothFloatingElementsProps {
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
  isVisible: boolean
}

export function SmoothFloatingElements({ mouseX, mouseY, isVisible }: SmoothFloatingElementsProps) {
  const suits = [Spade, Heart, Diamond, Club]

  // Smooth mouse tracking
  const smoothMouseX = useSpring(mouseX, { stiffness: 150, damping: 30 })
  const smoothMouseY = useSpring(mouseY, { stiffness: 150, damping: 30 })

  // Central shape transforms
  const centralRotateX = useTransform(smoothMouseY, [-1, 1], [-8, 8])
  const centralRotateY = useTransform(smoothMouseX, [-1, 1], [-8, 8])

  // Memoize suit positions and animations
  const suitConfigs = useMemo(
    () =>
      suits.map((Icon, index) => ({
        Icon,
        id: index,
        style: {
          left: `${30 + (index % 2) * 40}%`,
          top: `${20 + Math.floor(index / 2) * 60}%`,
        },
        animation: {
          y: [0, -15, 0],
          rotate: [0, 6, -6, 0],
          scale: [1, 1.05, 1],
        },
        duration: 5 + index * 0.5,
        delay: 0.5 + index * 0.15,
      })),
    [],
  )

  // Memoize particle positions
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        style: {
          left: `${15 + Math.random() * 70}%`,
          top: `${15 + Math.random() * 70}%`,
        },
        animation: {
          y: [0, -25, 0],
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.2, 1],
        },
        duration: 4 + i * 0.3,
        delay: i * 0.4,
      })),
    [],
  )

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.9,
      }}
      transition={{ duration: 1.5, ease: [0.6, 0.01, 0.05, 0.95] }}
      className="relative h-full w-full will-change-transform"
    >
      {/* Central elegant shape */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-gradient-to-br from-stone-200/50 to-stone-300/50 backdrop-blur-sm dark:from-stone-800/50 dark:to-stone-900/50"
        style={{
          rotateX: centralRotateX,
          rotateY: centralRotateY,
          willChange: "transform",
        }}
        animate={{
          scale: [1, 1.03, 1],
        }}
        transition={{
          scale: {
            duration: 6,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          },
        }}
      />

      {/* Floating card suits */}
      {suitConfigs.map(({ Icon, id, style, animation, duration, delay }) => (
        <motion.div
          key={id}
          className="absolute"
          style={style}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.8, scale: 1 }}
          transition={{ delay, duration: 1 }}
        >
          <motion.div
            animate={animation}
            transition={{
              duration,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/30 backdrop-blur-sm transition-colors duration-300 hover:bg-white/50 dark:bg-stone-900/30 dark:hover:bg-stone-900/50"
            whileHover={{
              scale: 1.1,
              transition: { duration: 0.2 },
            }}
          >
            <Icon className="h-8 w-8 text-stone-700 dark:text-stone-300" />
          </motion.div>
        </motion.div>
      ))}

      {/* Optimized particles */}
      {particles.map(({ id, style, animation, duration, delay }) => (
        <motion.div
          key={id}
          className="absolute h-1.5 w-1.5 rounded-full bg-stone-400/30 dark:bg-stone-600/30"
          style={style}
          animate={animation}
          transition={{
            duration,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay,
          }}
        />
      ))}

      {/* Subtle glow effect */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-stone-300/10 to-stone-400/10 blur-3xl dark:from-stone-600/10 dark:to-stone-700/10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  )
}
