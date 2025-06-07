"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import type { ReactNode } from "react"

interface AnimateOnViewProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function AnimateOnView({ children, className, delay = 0 }: AnimateOnViewProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  const variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={{ duration: 0.8, ease: [0.6, 0.01, 0.05, 0.95], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
} 