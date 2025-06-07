"use client"

import { motion, useTransform, useSpring, type MotionValue, AnimatePresence } from "framer-motion"
import { Spade, Heart, Diamond, Club } from "lucide-react"
import { useMemo, useState, useEffect } from "react"
import { FloatingSuitIcon } from "./FloatingSuitIcon"

interface SmoothFloatingElementsProps {
  mouseX: MotionValue<number>
  mouseY: MotionValue<number>
  isVisible: boolean
  isCheckHovered: boolean
}

export function SmoothFloatingElements({ mouseX, mouseY, isVisible, isCheckHovered }: SmoothFloatingElementsProps) {
  const suits = [Spade, Heart, Diamond, Club]
  const [particles, setParticles] = useState<any[]>([])

  useEffect(() => {
    setParticles(
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
    )
  }, [])

  // Smooth mouse tracking
  const smoothMouseX = useSpring(mouseX, { stiffness: 150, damping: 30 })
  const smoothMouseY = useSpring(mouseY, { stiffness: 150, damping: 30 })

  // Central shape transforms
  const centralRotateX = useTransform(smoothMouseY, [-1, 1], [-8, 8])
  const centralRotateY = useTransform(smoothMouseX, [-1, 1], [-8, 8])
  
  // Parallax for suits and particles
  const suitX = useTransform(smoothMouseX, [-1, 1], [-15, 15])
  const suitY = useTransform(smoothMouseY, [-1, 1], [-15, 15])
  const particleX = useTransform(smoothMouseX, [-1, 1], [30, -30])
  const particleY = useTransform(smoothMouseY, [-1, 1], [30, -30])

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
      {/* Central Interactive Blob/Card */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          rotateX: centralRotateX,
          rotateY: centralRotateY,
          willChange: "transform",
        }}
      >
        <AnimatePresence mode="wait">
          {!isCheckHovered ? (
            // Blob State
            <motion.div
              key="blob"
              className="h-96 w-96 rounded-[40%] bg-gradient-to-br from-stone-200/50 to-stone-300/50 backdrop-blur-sm dark:from-stone-800/50 dark:to-stone-900/50"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: [1, 1.03, 1],
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                rotateY: -90,
                transition: { duration: 0.4, ease: "easeInOut" },
              }}
              transition={{
                opacity: { duration: 0.4, ease: "easeOut" },
                scale: {
                  duration: 6,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
              }}
            />
          ) : (
            // Card State
            <motion.div
              key="card"
              className="relative"
              initial={{
                opacity: 0,
                scale: 0.8,
                rotateY: 180,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                rotateY: 0,
                rotateZ: [0, 1.5, -1.5, 1.5, -1.5, 0],
                y: [0, -6, 0],
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                rotateY: 180,
                transition: { duration: 0.4, ease: "easeInOut" },
              }}
              transition={{
                opacity: { duration: 0.5, ease: "easeInOut" },
                scale: { duration: 0.5, ease: "easeInOut" },
                rotateY: { duration: 0.5, ease: "easeInOut" },
                rotateZ: {
                  duration: 15,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.7,
                },
                y: {
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.7,
                },
              }}
              style={{ perspective: "1000px" }}
            >
              {/* Card Back (initially visible) */}
              <motion.div
                className="absolute inset-0 h-80 w-56 rounded-lg border-2 border-stone-200 bg-gradient-to-br from-stone-100 to-stone-200/60 shadow-xl dark:border-stone-800 dark:from-stone-800 dark:to-stone-900/60"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                {/* Card Back Pattern */}
                <div className="absolute inset-4 rounded border border-stone-300/30 dark:border-stone-700/30">
                  <div className="flex h-full items-center justify-center">
                    <div className="font-serif text-lg font-light italic text-stone-600/50 dark:text-stone-400/50">
                      Check
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Card Front (Ace of Spades) */}
              <motion.div
                className="h-80 w-56 rounded-lg border-2 border-stone-200 bg-stone-50 shadow-xl dark:border-stone-800 dark:bg-stone-900"
                style={{ backfaceVisibility: "hidden" }}
              >
                {/* Ace of Spades Content */}
                <div className="relative flex h-full flex-col justify-between p-4">
                  {/* Top Left */}
                  <motion.div
                    className="font-serif text-xl font-light text-stone-900 dark:text-stone-100"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1, duration: 0.3 }}
                  >
                    <div>A</div>
                    <div className="text-lg leading-none">♠</div>
                  </motion.div>

                  {/* Center Large Spade */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center text-8xl font-light text-stone-900 dark:text-stone-100"
                    initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{
                      delay: 1.2,
                      duration: 0.6,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                  >
                    ♠
                  </motion.div>

                  {/* Bottom Right (Rotated) */}
                  <motion.div
                    className="self-end rotate-180 font-serif text-xl font-light text-stone-900 dark:text-stone-100"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1, duration: 0.3 }}
                  >
                    <div>A</div>
                    <div className="text-lg leading-none">♠</div>
                  </motion.div>
                </div>

                {/* Card Glow Effect */}
                <motion.div
                  className="absolute -inset-2 rounded-lg bg-gradient-to-r from-stone-900/10 via-stone-900/20 to-stone-900/10 blur-xl dark:from-stone-100/10 dark:via-stone-100/20 dark:to-stone-100/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Floating card suits */}
      {suitConfigs.map(({ Icon, id, style, animation, duration, delay }) => (
        <motion.div
          key={id}
          className="absolute"
          style={{ ...style, x: suitX, y: suitY }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.8, scale: 1 }}
          transition={{ delay, duration: 1 }}
        >
          <FloatingSuitIcon
            Icon={Icon}
            animation={animation}
            duration={duration}
            isCheckHovered={isCheckHovered}
          />
        </motion.div>
      ))}

      {/* Optimized particles */}
      <motion.div style={{ x: particleX, y: particleY }}>
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
      </motion.div>

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