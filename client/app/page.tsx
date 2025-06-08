"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue, AnimatePresence, useMotionValueEvent, MotionValue, useMotionTemplate, useReducedMotion } from "framer-motion"
import { useTheme } from "next-themes"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronDown, Spade, Heart, Diamond, Users, ArrowRight } from "lucide-react"
import { FaGithub, FaSpotify, FaDiscord } from "react-icons/fa"
import { NewGameModal } from "@/components/modals/NewGameModal"
import { JoinGameModal } from "@/components/modals/JoinGameModal"
import { OptimizedShapes } from "@/components/ui/OptimizedShapes"
import { SmoothFloatingElements } from "@/components/ui/SmoothFloatingElements"
import { PrincipleCard } from "@/components/ui/PrincipleCard"
import { CardStack } from "@/components/ui/CardStack"
import { AnimateOnView } from "@/components/ui/AnimateOnView"
import Magnetic from "@/components/ui/Magnetic"
import { Signature } from "@/components/ui/Signature"
import { Scrollytelling } from "@/components/ui/Scrollytelling"

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

function FeatureItem({
  index,
  feature,
  continuousActiveCard,
}: {
  index: number
  feature: { title: string; description: string }
  continuousActiveCard: MotionValue<number>
}) {
  const diff = useTransform(continuousActiveCard, latest => index - latest)

  const opacity = useTransform(diff, [-1, -0.5, 0, 0.5, 1], [0.5, 1, 1, 1, 0.5])
  const scale = useTransform(diff, [-1, -0.5, 0, 0.5, 1], [0.9, 1, 1, 1, 0.9])
  
  const bgOpacity = useTransform(diff, [-0.5, 0, 0.5], [0, 1, 0])

  const backgroundColor = useTransform(bgOpacity, v => `rgba(var(--feature-item-bg-rgb), ${v})`)

  const textColor = useTransform(
    bgOpacity,
    [0, 1],
    [`hsl(var(--foreground))`, `hsl(var(--feature-item-text-color-hsl))`]
  )
  const mutedTextColor = useTransform(
    bgOpacity,
    [0, 1],
    [`hsl(var(--muted-foreground))`, `hsl(var(--feature-item-text-color-hsl) / 0.7)`]
  )

  return (
    <motion.div
      className="p-8 rounded-3xl"
      style={{
        opacity,
        scale,
        backgroundColor,
      }}
    >
      <motion.h3 style={{ color: textColor }} className="text-2xl font-normal text-stone-900 dark:text-stone-100 mb-3">{feature.title}</motion.h3>
      <motion.p style={{ color: mutedTextColor }} className="text-stone-600 dark:text-stone-400 font-light leading-relaxed">{feature.description}</motion.p>
    </motion.div>
  )
}

export default function Home() {
  const [showNewGame, setShowNewGame] = useState(false)
  const [showJoinGame, setShowJoinGame] = useState(false)
  const [isCheckHovered, setIsCheckHovered] = useState(false)
  const [isAtTop, setIsAtTop] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isSignatureVisible, setIsSignatureVisible] = useState(false)
  const [isPrecisionHovered, setIsPrecisionHovered] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const precisionHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const endOfPageRef = useRef<HTMLDivElement>(null)
  const isHeroInView = useInView(heroRef, { amount: 0.3 })
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const shouldReduceMotion = useReducedMotion()

  const features = [
    {
      title: "Seamless UI",
      description: "A clean, intuitive interface that lets you focus on your strategy. No clutter, just pure gameplay.",
    },
    {
      title: "Fluid Animations",
      description: "Every action, from drawing a card to calling 'Check', is accompanied by smooth, satisfying animations.",
    },
    {
      title: "Haptic Feedback",
      description: "Feel the game with subtle vibrations and feedback that make the digital experience feel tangible.",
    },
  ];

  const { scrollYProgress: footerScrollYProgress } = useScroll({
    target: endOfPageRef,
    offset: ["start end", "end end"],
  })

  const smoothFooterScrollYProgress = useSpring(footerScrollYProgress, {
    stiffness: 50,
    damping: 25,
  })

  const footerY = useTransform(smoothFooterScrollYProgress, [0, 0.6], ["100%", "0%"])

  const signatureTriggerProgress = useTransform(smoothFooterScrollYProgress, [0.5, 0.9], [0, 1])

  useMotionValueEvent(signatureTriggerProgress, "change", (latest: number) => {
    setIsSignatureVisible(latest > 0)
  })

  const checkText = (isCheckHovered ? "Check!" : "Check").split("")

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 40, stiffness: 200, mass: 0.7 }

  const textX1 = useSpring(useTransform(mouseX, [-1, 1], shouldReduceMotion ? [0, 0] : [-15, 15]), springConfig)
  const textY1 = useSpring(useTransform(mouseY, [-1, 1], shouldReduceMotion ? [0, 0] : [-15, 15]), springConfig)
  const textX2 = useSpring(useTransform(mouseX, [-1, 1], shouldReduceMotion ? [0, 0] : [-25, 25]), springConfig)
  const textY2 = useSpring(useTransform(mouseY, [-1, 1], shouldReduceMotion ? [0, 0] : [-25, 25]), springConfig)

  const { scrollY, scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  useMotionValueEvent(scrollY, "change", latest => {
    const atTop = latest < 50
    if (atTop !== isAtTop) {
      setIsAtTop(atTop)
    }
    if (!atTop && isInitialLoad) {
      setIsInitialLoad(false)
    }
  })

  const heroY = useTransform(smoothProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["0%", "-30%"])
  const shapeY = useTransform(smoothProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["0%", "20%"])

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
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen flex-col bg-stone-50 dark:bg-zinc-950 noselect"
    >
      <OptimizedShapes mouseX={mouseX} mouseY={mouseY} scrollY={shapeY} shouldReduceMotion={shouldReduceMotion ?? false} />

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
              animate={!shouldReduceMotion ? {
                rotate: [0, 3, -3, 0],
                scale: [1, 1.02, 1],
              } : {}}
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
                  data-cursor-icon
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
                        style={{ x: textX1, y: textY1, willChange: "transform" }}
                      >
                        The
                      </motion.span>
                      <motion.span
                        className="relative ml-8 inline-block font-normal italic"
                        initial={{ opacity: 0, x: -60 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.2, delay: 1.5, ease: [0.6, 0.01, 0.05, 0.95] }}
                        style={{ x: textX2, y: textY2, willChange: "transform" }}
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
                          data-cursor-icon
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
                    <Magnetic>
                      <motion.div
                        whileHover={{ y: -3, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Button
                          size="lg"
                          onClick={() => setShowNewGame(true)}
                          data-cursor-link
                          className="group relative overflow-hidden rounded-full bg-stone-900 px-8 py-4 text-lg font-light text-white shadow-xl transition-all duration-300 hover:shadow-2xl dark:bg-stone-100 dark:text-stone-900"
                        >
                          <span className="pointer-events-none relative z-10 flex items-center gap-2">
                            Start New Game
                            <motion.div
                              animate={!shouldReduceMotion ? { x: [0, 4, 0] } : {}}
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
                          data-cursor-link
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

              <div className="relative hidden h-full items-center justify-center lg:flex">
                <SmoothFloatingElements mouseX={mouseX} mouseY={mouseY} isVisible={isHeroInView} isCheckHovered={isCheckHovered} shouldReduceMotion={shouldReduceMotion ?? false} />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isAtTop ? 1 : 0 }}
              transition={
                isInitialLoad ? { delay: 3, duration: 1.5 } : { duration: 0.5, ease: "easeOut" }
              }
              className="absolute bottom-12 left-1/2 -translate-x-1/2"
            >
              <motion.div
                animate={!shouldReduceMotion ? { y: [0, 8, 0] } : {}}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 3,
                  ease: "easeInOut",
                }}
                className="flex cursor-pointer flex-col items-center gap-2 text-stone-500 transition-colors duration-300 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300"
                onClick={() => {
                  document.getElementById("game-principles-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
              >
                <span className="text-sm font-light tracking-wide">Discover more</span>
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        <Scrollytelling />

        <section id="leaderboard" className="relative py-40">
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
                    data-cursor-link
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
                    data-cursor-link
                  >
                    Join Friends
                  </Button>
                </motion.div>
              </div>
            </AnimateOnView>
          </div>
        </section>
        <div ref={endOfPageRef} className="h-20" />
      </main>

      <motion.footer
        style={{ y: footerY }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200/60 bg-white/80 backdrop-blur-sm dark:border-stone-800/60 dark:bg-zinc-950/80"
      >
        <div className="container mx-auto grid grid-cols-1 items-center gap-4 px-4 py-4 text-center sm:grid-cols-3 sm:text-left">
          <div className="flex items-center gap-3 justify-self-center sm:justify-self-start">
            <Spade className="h-5 w-5 text-stone-700 dark:text-stone-300" />
            <span className="text-lg font-light text-stone-900 dark:text-stone-100">Check</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-light text-stone-500 dark:text-stone-500 sm:gap-x-2">
            <div className="flex items-center">
              <span>© {new Date().getFullYear()} Check Card Game.</span>
            </div>
            <div className="hidden sm:block">|</div>
            <div
              className="flex items-center"
              onMouseEnter={() => {
                if (precisionHoverTimeoutRef.current) {
                  clearTimeout(precisionHoverTimeoutRef.current);
                }
                setIsPrecisionHovered(true);
              }}
              onMouseLeave={() => {
                precisionHoverTimeoutRef.current = setTimeout(() => {
                  setIsPrecisionHovered(false);
                }, 500);
              }}
              data-cursor-icon
            >
              <span>Crafted with&nbsp;</span>
              <div className="relative h-6 min-w-[5rem]">
                <AnimatePresence>
                  {isPrecisionHovered ? (
                    <motion.span
                      key="passion"
                      className="absolute inset-0 flex items-center justify-start"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      brainrot.
                    </motion.span>
                  ) : (
                    <motion.span
                      key="precision"
                      className="absolute inset-0 flex items-center justify-start"
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      precision.
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div
              className="flex items-center"
              data-cursor-icon
            >
              <span>Made by&nbsp;</span>
              <div className="relative h-6 min-w-[5rem] ml-2">
                <motion.div
                  key="signature"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Signature isInView={isSignatureVisible} />
                </motion.div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 sm:justify-self-end">
            <motion.a
              href="https://github.com/vroslmend"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              whileHover={{ y: -3, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-cursor-icon
            >
              <span className="sr-only">GitHub</span>
              <FaGithub className="h-5 w-5" />
            </motion.a>
            <motion.a
              href="https://open.spotify.com/user/6tf81fs0qm2akdo4yt1wp1akw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              whileHover={{ y: -3, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-cursor-icon
            >
              <span className="sr-only">Spotify</span>
              <FaSpotify className="h-5 w-5" />
            </motion.a>
            <motion.a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              whileHover={{ y: -3, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-cursor-icon
            >
              <span className="sr-only">Discord</span>
              <FaDiscord className="h-5 w-5" />
            </motion.a>
          </div>
        </div>
      </motion.footer>

      <AnimatePresence>
        {showNewGame && <NewGameModal isOpen={showNewGame} onClose={() => setShowNewGame(false)} />}
        {showJoinGame && <JoinGameModal isOpen={showJoinGame} onClose={() => setShowJoinGame(false)} />}
      </AnimatePresence>
    </div>
  )
}