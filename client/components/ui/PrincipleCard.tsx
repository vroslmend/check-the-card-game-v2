"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { ElementType, useRef } from "react"

interface PrincipleCardProps {
  icon: ElementType
  title: string
  description: string
}

export function PrincipleCard({ icon: Icon, title, description }: PrincipleCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const xSpring = useSpring(x, { stiffness: 300, damping: 30 })
  const ySpring = useSpring(y, { stiffness: 300, damping: 30 })

  const rotateX = useTransform(ySpring, [-0.5, 0.5], ["12deg", "-12deg"])
  const rotateY = useTransform(xSpring, [-0.5, 0.5], ["-12deg", "12deg"])
  const scale = useTransform(xSpring, [-0.5, 0.5], [1.05, 0.95])
  const translateZ = useTransform(ySpring, [-0.5, 0.5], [20, -10])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const mouseX = e.clientX - left
    const mouseY = e.clientY - top
    x.set((mouseX - width / 2) / (width / 2))
    y.set((mouseY - height / 2) / (height / 2))
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        scale,
        transformStyle: "preserve-3d",
      }}
      className="group relative h-full"
    >
      <div
        style={{
          transform: "translateZ(80px)",
          transformStyle: "preserve-3d",
        }}
        className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-white/60 p-10 backdrop-blur-sm transition-colors duration-500 group-hover:bg-white/80 dark:bg-stone-900/60 dark:group-hover:bg-stone-900/80"
      >
        <motion.div
          style={{
            transform: "translateZ(50px)",
          }}
          className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800 transition-colors duration-500 group-hover:bg-stone-800 dark:group-hover:bg-stone-100"
        >
          <Icon className="h-10 w-10 text-stone-700 dark:text-stone-300 transition-colors duration-500 group-hover:text-stone-300 dark:group-hover:text-stone-700" />
        </motion.div>
        <motion.h3
          style={{
            transform: "translateZ(40px)",
          }}
          className="mb-4 text-2xl font-light text-stone-900 dark:text-stone-100"
        >
          {title}
        </motion.h3>
        <motion.p
          style={{
            transform: "translateZ(30px)",
          }}
          className="font-light leading-relaxed text-stone-600 dark:text-stone-400"
        >
          {description}
        </motion.p>
      </div>
    </motion.div>
  )
} 