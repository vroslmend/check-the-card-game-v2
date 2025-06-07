"use client"

import { useRef, useEffect } from "react"
import { motion } from "framer-motion"

interface CardOrbProps {
  mousePosition: { x: number; y: number }
  isVisible: boolean
}

export function CardOrb({ mousePosition, isVisible }: CardOrbProps) {
  const orbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!orbRef.current) return

    const orb = orbRef.current
    const rect = orb.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const rotateX = mousePosition.y * 20
    const rotateY = mousePosition.x * 20

    orb.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
  }, [mousePosition])

  return (
    <motion.div
      ref={orbRef}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0,
        rotateZ: 360,
      }}
      transition={{
        opacity: { duration: 1 },
        scale: { duration: 1, type: "spring", stiffness: 100 },
        rotateZ: { duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
      }}
      className="absolute right-10 top-1/2 hidden -translate-y-1/2 lg:block"
    >
      <div className="relative h-96 w-96">
        {/* Main orb */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-purple-500/20 to-primary/20 blur-xl" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm" />

        {/* Floating cards around orb */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-8 w-6 rounded-sm bg-gradient-to-br from-primary/30 to-purple-500/30 backdrop-blur-sm"
            style={{
              left: "50%",
              top: "50%",
              transformOrigin: "50% 150px",
            }}
            animate={{
              rotate: [i * 45, i * 45 + 360],
            }}
            transition={{
              duration: 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
              delay: i * 0.2,
            }}
          />
        ))}

        {/* Center glow */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/40 blur-2xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </div>
    </motion.div>
  )
}
