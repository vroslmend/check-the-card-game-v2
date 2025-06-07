"use client"

import { useRef } from "react"
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
  useSpring,
} from "framer-motion"
import { PrincipleCard } from "./PrincipleCard"
import type { ElementType } from "react"

interface ParallaxPrincipleCardProps {
  icon: ElementType
  title: string
  description: string
}

export function ParallaxPrincipleCard({
  icon,
  title,
  description,
}: ParallaxPrincipleCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const y = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"])
  const springY = useSpring(y, {
    stiffness: 100,
    damping: 15,
    mass: 1.2,
    restDelta: 0.001,
  })

  const scale = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0.8, 1, 1, 0.8])
  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0.5, 1, 1, 0.5])

  return (
    <motion.div
      ref={ref}
      style={{ y: springY, scale, opacity }}
      className="relative h-full"
      data-cursor-area
    >
      <PrincipleCard
        icon={icon}
        title={title}
        description={description}
      />
    </motion.div>
  )
}