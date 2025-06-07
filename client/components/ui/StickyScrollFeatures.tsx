"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useRef, useState, useEffect } from "react"
import { CardStack } from "./CardStack"
import { Users, BrainCircuit, Trophy } from "lucide-react"
import { useScrollHijack } from "@/hooks/use-scroll-hijack"

const features = [
  {
    icon: Users,
    title: "Real-time Multiplayer",
    description:
      "Connect with players worldwide in seamless, lag-free matches. Our sophisticated networking ensures every move is perfectly synchronized.",
    features: ["Instant matchmaking", "Private rooms", "Spectator mode", "Cross-platform play"],
  },
  {
    icon: BrainCircuit,
    title: "Advanced Strategy",
    description:
      "Dive deep into complex card combinations and psychological gameplay. Master the art of reading opponents and timing your moves.",
    features: ["Bluffing mechanics", "Power card synergies", "Chain reactions", "Meta evolution"],
  },
  {
    icon: Trophy,
    title: "Competitive Excellence",
    description:
      "Climb the global rankings through skill and dedication. Participate in seasonal tournaments and earn prestigious achievements.",
    features: ["ELO rating system", "Seasonal tournaments", "Achievement system", "Leaderboards"],
  },
]

const contentVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.8,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.8,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
    }
  }),
}

const childVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
};

export function StickyScrollFeatures() {
  const {
    sectionRef,
    activeIndex,
    sectionHeight,
    featureProgresses,
  } = useScrollHijack(features.length)

  const prevIndex = useRef(0)
  const [direction, setDirection] = useState(0)

  useEffect(() => {
    setDirection(activeIndex > prevIndex.current ? 1 : -1)
    prevIndex.current = activeIndex
  }, [activeIndex])


  return (
    <div id="features" className="py-32">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="mb-24 text-center text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
          A Refined Experience
        </h2>
      </div>
      <section ref={sectionRef} style={{ height: sectionHeight }} className="relative">
        <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
          <div className="container relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-16 px-4 lg:grid-cols-2">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={activeIndex}
                variants={contentVariants}
                custom={direction}
                initial="enter"
                animate="center"
                exit="exit"
                className="col-span-2 grid grid-cols-1 items-center gap-16 lg:grid-cols-2"
              >
                {/* Left Text Content */}
                <motion.div
                  variants={childVariants}
                  className="space-y-6 rounded-xl bg-stone-100/50 p-8 dark:bg-stone-900/50 border border-stone-200/80 dark:border-stone-800/80 backdrop-blur-sm relative overflow-hidden h-[28rem] flex flex-col justify-center"
                >
                  <motion.h3 variants={childVariants} className="text-3xl font-light tracking-tight text-stone-900 dark:text-stone-100">
                    {features[activeIndex].title}
                  </motion.h3>
                  <motion.p variants={childVariants} className="text-lg font-light leading-relaxed text-stone-600 dark:text-stone-400">
                    {features[activeIndex].description}
                  </motion.p>
                  <motion.ul variants={childVariants} className="space-y-3">
                    {features[activeIndex].features.map(item => (
                      <li key={item} className="flex items-center gap-3 font-light text-stone-700 dark:text-stone-300">
                        <div className="h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-600" />
                        {item}
                      </li>
                    ))}
                  </motion.ul>
                  <div className="absolute bottom-4 left-4 right-4 h-1 bg-stone-200/80 dark:bg-stone-800/80 rounded-full">
                    <motion.div className="h-full bg-gradient-to-r from-stone-800 to-stone-600 dark:from-stone-200 dark:to-stone-400 rounded-full" style={{ scaleX: featureProgresses[activeIndex], transformOrigin: 'left' }} />
                  </div>
                </motion.div>

                {/* Right Card Visual */}
                <motion.div
                  variants={childVariants}
                  className="flex h-[28rem] w-full flex-col items-center justify-around rounded-xl bg-stone-100/50 p-8 dark:bg-stone-900/50 border border-stone-200/80 dark:border-stone-800/80 backdrop-blur-sm"
                >
                  <motion.div
                    className="flex h-32 w-32 items-center justify-center rounded-full bg-stone-200/70 dark:bg-stone-800/70 shadow-inner"
                  >
                    {(() => {
                      const Icon = features[activeIndex].icon;
                      return <Icon size={56} strokeWidth={1} className="text-stone-600 dark:text-stone-300"/>;
                    })()}
                  </motion.div>
                  <CardStack activeCard={activeIndex} />
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  )
} 