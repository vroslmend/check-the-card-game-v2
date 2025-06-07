"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion"
import { PrincipleCard } from "./PrincipleCard"
import type { ElementType } from "react"

interface ParallaxPrincipleCardProps {
  icon: ElementType
  title: string
  description: string
}

function useParallax(value: MotionValue<number>, distance: number) {
  return useTransform(value, [0, 1], [distance, -distance])
}

export function ParallaxPrincipleCard({ icon, title, description }: ParallaxPrincipleCardProps) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ 
    target: ref, 
    offset: ["start end", "end start"] 
  })
  const y = useParallax(scrollYProgress, 200)
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.8, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.5, 1])

  return (
    <motion.div ref={ref} style={{ y, scale, opacity }} className="relative h-full">
      <PrincipleCard
        icon={icon}
        title={title}
        description={description}
      />
    </motion.div>
  )
} 