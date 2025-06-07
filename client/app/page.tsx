"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue, AnimatePresence } from "framer-motion"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronDown, Spade, Heart, Diamond, Users, ArrowRight } from "lucide-react"
import { NewGameModal } from "@/components/modals/NewGameModal"
import { JoinGameModal } from "@/components/modals/JoinGameModal"
import { OptimizedShapes } from "@/components/ui/OptimizedShapes"
import { SmoothFloatingElements } from "@/components/ui/SmoothFloatingElements"
import { useCursorStore } from "@/store/cursorStore"
import { PrincipleCard } from "@/components/ui/PrincipleCard"
import { ParallaxPrincipleCard } from "@/components/ui/ParallaxPrincipleCard"
import { CardStack } from "@/components/ui/CardStack"
import { AnimateOnView } from "@/components/ui/AnimateOnView"
import Magnetic from "@/components/ui/Magnetic"

const textContainerVariants = {
  hover: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0,
    },
  },
};

const letterVariants = {
  initial: {
    y: 0,
  },
  hover: {
    y: -10,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10,
    },
  },
};

export default function Home() {
  const [showNewGame, setShowNewGame] = useState(false)
  const [showJoinGame, setShowJoinGame] = useState(false)
  const [isCheckHovered, setIsCheckHovered] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const isHeroInView = useInView(heroRef, { amount: 0.3 })
  const { setVariant } = useCursorStore()

  const checkText = (isCheckHovered ? "Check!" : "Check").split("");

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 40, stiffness: 200, mass: 0.7 }

  const textX1 = useSpring(useTransform(mouseX, [-1, 1], [-15, 15]), springConfig)
  const textY1 = useSpring(useTransform(mouseY, [-1, 1], [-15, 15]), springConfig)
  const textX2 = useSpring(useTransform(mouseX, [-1, 1], [-25, 25]), springConfig)
  const textY2 = useSpring(useTransform(mouseY, [-1, 1], [-25, 25]), springConfig)
  const pX = useSpring(useTransform(mouseX, [-1, 1], [-10, 10]), springConfig)
  const pY = useSpring(useTransform(mouseY, [-1, 1], [-10, 10]), springConfig)
  const buttonsX = useSpring(useTransform(mouseX, [-1, 1], [-18, 18]), springConfig)
  const buttonsY = useSpring(useTransform(mouseY, [-1, 1], [-18, 18]), springConfig)

  const { scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  const heroY = useTransform(smoothProgress, [0, 1], ["0%", "-30%"])
  const shapeY = useTransform(smoothProgress, [0, 1], ["0%", "20%"])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1

      mouseX.set(x)
      mouseY.set(y)
    },
    [mouseX, mouseY],
  )

  useEffect(() => {
    let lastTime = 0
    const throttleDelay = 16 // ~60fps

    const throttledMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - lastTime >= throttleDelay) {
        handleMouseMove(e)
        lastTime = now
      }
    }

    window.addEventListener("mousemove", throttledMouseMove, { passive: true })
    return () => {
      window.removeEventListener("mousemove", throttledMouseMove)
    }
  }, [handleMouseMove])

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen flex-col bg-stone-50 dark:bg-zinc-950 noselect"
    >
      <OptimizedShapes mouseX={mouseX} mouseY={mouseY} scrollY={shapeY} />

      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.6, 0.01, 0.05, 0.95] }}
        className="fixed top-0 z-50 w-full backdrop-blur-xl transition-all duration-700"
      >
        <div className="container mx-auto flex h-24 items-center justify-between px-4">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="flex items-center gap-4"
          >
            <motion.div
              animate={{
                rotate: [0, 3, -3, 0],
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900/5 backdrop-blur-sm dark:bg-stone-100/5"
            >
              <Spade className="h-5 w-5 text-stone-900 dark:text-stone-100" />
            </motion.div>
            <span className="text-3xl font-light tracking-tight text-stone-900 dark:text-stone-100">Check</span>
          </motion.div>

          <motion.nav
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="flex items-center gap-12"
          >
            {["Rules", "Features", "Leaderboard"].map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.6 }}
              >
                <Link
                  href={`#${item.toLowerCase()}`}
                  className="relative text-sm font-light tracking-wide text-stone-600 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                  onMouseEnter={() => setVariant("link")}
                  onMouseLeave={() => setVariant("default")}
                >
                  {item}
                  <motion.div
                    className="absolute -bottom-1 left-0 h-px bg-stone-900 dark:bg-stone-100"
                    initial={{ width: 0 }}
                    whileHover={{ width: "100%" }}
                    transition={{ duration: 0.3 }}
                  />
                </Link>
              </motion.div>
            ))}
            <ThemeToggle />
          </motion.nav>
        </div>
      </motion.header>

      <main className="flex-1">
        <section ref={heroRef} className="relative flex min-h-screen items-center justify-center">
          <motion.div style={{ y: heroY }} className="container relative z-10 mx-auto px-4">
            <div className="grid min-h-screen items-center lg:grid-cols-2" style={{ perspective: '1000px' }}>
              <motion.div
                className="flex flex-col justify-center space-y-12"
              >
                <motion.div
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.2, delay: 1, ease: [0.6, 0.01, 0.05, 0.95] }}
                  className="space-y-8"
                >
                  <motion.div
                    className="inline-flex items-center gap-3 rounded-full border border-stone-200/60 bg-white/40 px-6 py-3 backdrop-blur-sm dark:border-stone-800/60 dark:bg-stone-900/40"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.7, 1, 0.7],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                      className="h-2 w-2 rounded-full bg-emerald-500"
                    />
                    <span className="text-sm font-light tracking-wide text-stone-700 dark:text-stone-300">
                      Multiplayer Card Experience
                    </span>
                  </motion.div>

                  <div className="space-y-10">
                    <h1
                      className="text-7xl font-light leading-none tracking-tighter text-stone-900 dark:text-stone-100 md:text-8xl lg:text-9xl"
                    >
                      <motion.span
                        className="block"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 1.2 }}
                        style={{ x: textX1, y: textY1 }}
                      >
                        The
                      </motion.span>
                      <motion.span
                        className="relative ml-8 inline-block font-normal italic"
                        initial={{ opacity: 0, x: -60 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.2, delay: 1.5, ease: [0.6, 0.01, 0.05, 0.95] }}
                        style={{ x: textX2, y: textY2 }}
                      >
                        <motion.span
                          variants={textContainerVariants}
                          initial="initial"
                          whileHover="hover"
                          onMouseEnter={() => {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                            }
                            hoverTimeoutRef.current = setTimeout(() => {
                              setIsCheckHovered(true);
                            }, 300);
                          }}
                          onMouseLeave={() => {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                            }
                            setIsCheckHovered(false);
                          }}
                          className="flex"
                          aria-label="Check"
                        >
                          <AnimatePresence initial={false}>
                            {checkText.map((char, index) => {
                              if (char === "!") {
                                return (
                                  <motion.span
                                    key={index}
                                    className="inline-block"
                                    initial={{ opacity: 0, width: 0, x: -10 }}
                                    animate={{ opacity: 1, width: "auto", x: 0 }}
                                    exit={{ opacity: 0, width: 0, x: 10 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                  >
                                    {char}
                                  </motion.span>
                                );
                              }
                              return (
                                <motion.span
                                  key={index}
                                  variants={letterVariants}
                                  className="inline-block"
                                >
                                  {char}
                                </motion.span>
                              );
                            })}
                          </AnimatePresence>
                        </motion.span>
                        <motion.div
                          initial={{ scaleX: 0, originX: 0.5 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 1.5, delay: 2.2, ease: [0.6, 0.01, 0.05, 0.95] }}
                          className="absolute -bottom-3 left-[52%] h-1 w-[96%] -translate-x-1/2 bg-gradient-to-r from-stone-900 to-stone-600 dark:from-stone-100 dark:to-stone-400"
                        />
                      </motion.span>
                    </h1>

                    <motion.p
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 1, delay: 1.8 }}
                      className="max-w-lg text-xl font-light leading-relaxed text-stone-600 dark:text-stone-400"
                      style={{ x: pX, y: pY }}
                    >
                      A sophisticated card game where strategy meets elegance. Every decision shapes your destiny in
                      this refined multiplayer experience.
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 2.1 }}
                    className="flex flex-col gap-4 sm:flex-row"
                  >
                    <motion.div style={{ x: buttonsX, y: buttonsY }}>
                      <Magnetic>
                        <motion.div
                          whileHover={{ y: -3, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Button
                            size="lg"
                            onClick={() => setShowNewGame(true)}
                            onMouseEnter={() => setVariant("link")}
                            onMouseLeave={() => setVariant("default")}
                            className="group relative overflow-hidden rounded-full bg-stone-900 px-8 py-4 text-lg font-light text-white shadow-xl transition-all duration-300 hover:shadow-2xl dark:bg-stone-100 dark:text-stone-900"
                          >
                            <span className="pointer-events-none relative z-10 flex items-center gap-2">
                              Start New Game
                              <motion.div
                                animate={{ x: [0, 4, 0] }}
                                transition={{
                                  duration: 2,
                                  repeat: Number.POSITIVE_INFINITY,
                                  ease: "easeInOut",
                                }}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </motion.div>
                            </span>
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-stone-800 to-stone-700 dark:from-stone-200 dark:to-stone-300"
                              initial={{ x: "-100%" }}
                              whileHover={{ x: "0%" }}
                              transition={{ duration: 0.4, ease: "easeOut" }}
                            />
                          </Button>
                        </motion.div>
                      </Magnetic>
                    </motion.div>

                    <motion.div style={{ x: buttonsX, y: buttonsY }}>
                      <Magnetic>
                        <motion.div
                          whileHover={{ y: -3, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setShowJoinGame(true)}
                            onMouseEnter={() => setVariant("link")}
                            onMouseLeave={() => setVariant("default")}
                            className="rounded-full border-2 border-stone-200 bg-white/60 px-8 py-4 text-lg font-light text-stone-900 backdrop-blur-sm transition-all duration-300 hover:bg-white/80 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100 dark:hover:bg-stone-900/80"
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Join Game
                          </Button>
                        </motion.div>
                      </Magnetic>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>

              <div className="relative hidden h-full items-center justify-center lg:flex">
                <SmoothFloatingElements mouseX={mouseX} mouseY={mouseY} isVisible={isHeroInView} isCheckHovered={isCheckHovered} />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3, duration: 1.5 }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2"
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 3,
                  ease: "easeInOut",
                }}
                className="flex cursor-pointer flex-col items-center gap-2 text-stone-500 transition-colors duration-300 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300"
                onClick={() => {
                  document.getElementById("rules")?.scrollIntoView({ behavior: "smooth" })
                }}
              >
                <span className="text-sm font-light tracking-wide">Discover more</span>
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        <section id="rules" className="relative py-32">
          <div className="container px-4 mx-auto">
            <div className="mx-auto max-w-6xl">
              <AnimateOnView className="mb-20 text-center">
                <h2 className="mb-6 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
                  Game Principles
                </h2>
                <p className="mx-auto max-w-2xl text-xl font-light text-stone-600 dark:text-stone-400">
                  Elegant rules that create infinite strategic possibilities
                </p>
              </AnimateOnView>

              <div className="grid gap-16 lg:grid-cols-3" style={{ perspective: "1000px" }}>
                {[
                  {
                    icon: Spade,
                    title: "Strategic Depth",
                    description:
                      "Each suit carries unique powers and strategic implications. Master their interplay to dominate the table.",
                  },
                  {
                    icon: Heart,
                    title: "The Check",
                    description:
                      "Call 'Check' when confidence meets opportunity. But beware—miscalculation carries consequences.",
                  },
                  {
                    icon: Diamond,
                    title: "Victory Path",
                    description:
                      "First to successfully check with the highest hand claims the round. Best of five determines the champion.",
                  },
                ].map((rule, index) => (
                  <ParallaxPrincipleCard
                    key={index}
                    icon={rule.icon}
                    title={rule.title}
                    description={rule.description}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>


        <section id="leaderboard" className="relative py-32">
          <div className="container px-4 mx-auto">
            <AnimateOnView className="mx-auto max-w-4xl text-center">
              <h2 className="mb-8 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
                Ready to Begin?
              </h2>
              <p className="mb-16 text-xl font-light text-stone-600 dark:text-stone-400">
                Join the most sophisticated card game experience ever created.
              </p>

              <div className="flex flex-col gap-6 sm:flex-row sm:justify-center">
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    size="lg"
                    onClick={() => setShowNewGame(true)}
                    className="rounded-full bg-stone-900 px-12 py-4 text-lg font-light text-white shadow-xl transition-all duration-300 hover:shadow-2xl dark:bg-stone-100 dark:text-stone-900"
                  >
                    Start Playing
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowJoinGame(true)}
                    className="rounded-full border-2 border-stone-200 bg-white/60 px-12 py-4 text-lg font-light backdrop-blur-sm transition-all duration-300 hover:bg-white/80 dark:border-stone-800 dark:bg-stone-900/60 dark:hover:bg-stone-900/80"
                  >
                    Join Friends
                  </Button>
                </motion.div>
              </div>
            </AnimateOnView>
          </div>
        </section>
      </main>

      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="border-t border-stone-200/60 py-16 backdrop-blur-sm dark:border-stone-800/60"
      >
        <div className="container mx-auto flex flex-col items-center justify-between gap-8 px-4 md:flex-row">
          <div className="flex items-center gap-4">
            <Spade className="h-6 w-6 text-stone-700 dark:text-stone-300" />
            <span className="text-xl font-light text-stone-900 dark:text-stone-100">Check</span>
        </div>
          <div className="text-sm font-light text-stone-500 dark:text-stone-500">
            © {new Date().getFullYear()} Check Card Game. Crafted with precision.
          </div>
          <div className="flex gap-8">
            {["Privacy", "Terms", "Support"].map((item) => (
              <Link
                key={item}
                href="#"
                className="text-sm font-light text-stone-500 transition-colors duration-300 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300"
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </motion.footer>

      {showNewGame && <NewGameModal onClose={() => setShowNewGame(false)} />}
      {showJoinGame && <JoinGameModal onClose={() => setShowJoinGame(false)} />}
    </div>
  )
}