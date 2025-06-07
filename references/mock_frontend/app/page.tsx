"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue } from "framer-motion"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronDown, Spade, Heart, Diamond, Users, ArrowRight } from "lucide-react"
import { NewGameModal } from "@/components/new-game-modal"
import { JoinGameModal } from "@/components/join-game-modal"
import { OptimizedShapes } from "@/components/optimized-shapes"
import { SmoothFloatingElements } from "@/components/smooth-floating-elements"

export default function Home() {
  const [showNewGame, setShowNewGame] = useState(false)
  const [showJoinGame, setShowJoinGame] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const isHeroInView = useInView(heroRef, { amount: 0.3 })

  // Optimized mouse tracking with motion values
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const { scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  const heroY = useTransform(smoothProgress, [0, 1], ["0%", "-30%"])
  const shapeY = useTransform(smoothProgress, [0, 1], ["0%", "20%"])

  // Optimized mouse tracking with throttling
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
    let rafId: number
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
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [handleMouseMove])

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen flex-col overflow-hidden bg-stone-50 dark:bg-zinc-950"
    >
      {/* Optimized Background Shapes */}
      <OptimizedShapes mouseX={mouseX} mouseY={mouseY} scrollY={shapeY} />

      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.6, 0.01, 0.05, 0.95] }}
        className="fixed top-0 z-50 w-full backdrop-blur-xl transition-all duration-700"
      >
        <div className="container flex h-24 items-center justify-between">
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

      {/* Hero Section */}
      <main className="flex-1">
        <section ref={heroRef} className="relative flex min-h-screen items-center justify-center">
          <motion.div style={{ y: heroY }} className="container relative z-10 mx-auto px-4">
            <div className="grid min-h-screen items-center lg:grid-cols-2">
              {/* Left Content */}
              <div className="flex flex-col justify-center space-y-12">
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

                  <div className="space-y-6">
                    <h1 className="text-7xl font-light leading-none tracking-tighter text-stone-900 dark:text-stone-100 md:text-8xl lg:text-9xl">
                      <motion.span
                        className="block"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 1.2 }}
                      >
                        Master
                      </motion.span>
                      <motion.span
                        className="relative block font-normal italic"
                        initial={{ opacity: 0, x: -60 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1.2, delay: 1.5, ease: [0.6, 0.01, 0.05, 0.95] }}
                      >
                        Check
                        <motion.div
                          initial={{ scaleX: 0, originX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 1.5, delay: 2.2, ease: [0.6, 0.01, 0.05, 0.95] }}
                          className="absolute -bottom-2 left-0 h-1 w-full bg-gradient-to-r from-stone-900 to-stone-600 dark:from-stone-100 dark:to-stone-400"
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
                    <motion.div
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        size="lg"
                        onClick={() => setShowNewGame(true)}
                        className="group relative overflow-hidden rounded-full bg-stone-900 px-8 py-4 text-lg font-light text-white shadow-xl transition-all duration-300 hover:shadow-2xl dark:bg-stone-100 dark:text-stone-900"
                      >
                        <span className="relative z-10 flex items-center gap-2">
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

                    <motion.div
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setShowJoinGame(true)}
                        className="rounded-full border-2 border-stone-200 bg-white/60 px-8 py-4 text-lg font-light text-stone-900 backdrop-blur-sm transition-all duration-300 hover:bg-white/80 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100 dark:hover:bg-stone-900/80"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Join Game
                      </Button>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </div>

              {/* Right Visual Elements */}
              <div className="relative hidden lg:block">
                <SmoothFloatingElements mouseX={mouseX} mouseY={mouseY} isVisible={isHeroInView} />
              </div>
            </div>
          </motion.div>

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
        </section>

        {/* Rules Section */}
        <section id="rules" className="relative py-32">
          <div className="container px-4">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.2, ease: [0.6, 0.01, 0.05, 0.95] }}
              className="mx-auto max-w-6xl"
            >
              <div className="mb-20 text-center">
                <motion.h2
                  className="mb-6 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.2 }}
                >
                  Game Principles
                </motion.h2>
                <motion.p
                  className="mx-auto max-w-2xl text-xl font-light text-stone-600 dark:text-stone-400"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.4 }}
                >
                  Elegant rules that create infinite strategic possibilities
                </motion.p>
              </div>

              <div className="grid gap-16 lg:grid-cols-3">
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
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 60 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                    whileHover={{
                      y: -12,
                      transition: { duration: 0.4, ease: "easeOut" },
                    }}
                    className="group relative"
                  >
                    <div className="relative overflow-hidden rounded-3xl bg-white/60 p-10 backdrop-blur-sm transition-all duration-500 group-hover:bg-white/80 dark:bg-stone-900/60 dark:group-hover:bg-stone-900/80">
                      <motion.div
                        whileHover={{
                          rotate: 8,
                          scale: 1.1,
                          transition: { duration: 0.3 },
                        }}
                        className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800"
                      >
                        <rule.icon className="h-10 w-10 text-stone-700 dark:text-stone-300" />
                      </motion.div>
                      <h3 className="mb-4 text-2xl font-light text-stone-900 dark:text-stone-100">{rule.title}</h3>
                      <p className="font-light leading-relaxed text-stone-600 dark:text-stone-400">
                        {rule.description}
                      </p>

                      {/* Subtle hover effect */}
                      <motion.div
                        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-stone-200/20 to-stone-300/20 opacity-0 dark:from-stone-700/20 dark:to-stone-800/20"
                        whileHover={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative py-32">
          <div className="container px-4">
            <motion.h2
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.2, ease: [0.6, 0.01, 0.05, 0.95] }}
              className="mb-24 text-center text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100"
            >
              Refined Experience
            </motion.h2>

            <div className="mx-auto max-w-6xl space-y-32">
              {[
                {
                  title: "Real-time Multiplayer",
                  description:
                    "Connect with players worldwide in seamless, lag-free matches. Our sophisticated networking ensures every move is perfectly synchronized.",
                  features: ["Instant matchmaking", "Private rooms", "Spectator mode", "Cross-platform play"],
                },
                {
                  title: "Advanced Strategy",
                  description:
                    "Dive deep into complex card combinations and psychological gameplay. Master the art of reading opponents and timing your moves.",
                  features: ["Bluffing mechanics", "Power card synergies", "Chain reactions", "Meta evolution"],
                },
                {
                  title: "Competitive Excellence",
                  description:
                    "Climb the global rankings through skill and dedication. Participate in seasonal tournaments and earn prestigious achievements.",
                  features: ["ELO rating system", "Seasonal tournaments", "Achievement system", "Leaderboards"],
                },
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 80 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 1.2, delay: index * 0.2, ease: [0.6, 0.01, 0.05, 0.95] }}
                  className={`grid items-center gap-16 lg:grid-cols-2 ${
                    index % 2 === 1 ? "lg:grid-flow-col-dense" : ""
                  }`}
                >
                  <div className={`space-y-8 ${index % 2 === 1 ? "lg:col-start-2" : ""}`}>
                    <h3 className="text-4xl font-light tracking-tight text-stone-900 dark:text-stone-100">
                      {feature.title}
                    </h3>
                    <p className="text-xl font-light leading-relaxed text-stone-600 dark:text-stone-400">
                      {feature.description}
                    </p>
                    <ul className="space-y-4">
                      {feature.features.map((item, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -30 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                          className="flex items-center gap-3 font-light text-stone-700 dark:text-stone-300"
                        >
                          <motion.div
                            className="h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-600"
                            whileHover={{ scale: 1.5 }}
                            transition={{ duration: 0.2 }}
                          />
                          {item}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                  <div className={`${index % 2 === 1 ? "lg:col-start-1" : ""}`}>
                    <motion.div
                      className="aspect-square rounded-3xl bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-800 dark:to-stone-900"
                      whileHover={{
                        scale: 1.02,
                        rotate: 1,
                        transition: { duration: 0.4 },
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-32">
          <div className="container px-4">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.2, ease: [0.6, 0.01, 0.05, 0.95] }}
              className="mx-auto max-w-4xl text-center"
            >
              <h2 className="mb-8 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
                Ready to Begin?
              </h2>
              <p className="mb-16 text-xl font-light text-stone-600 dark:text-stone-400">
                Join the most sophisticated card game experience ever created.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
                className="flex flex-col gap-6 sm:flex-row sm:justify-center"
              >
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
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="border-t border-stone-200/60 py-16 backdrop-blur-sm dark:border-stone-800/60"
      >
        <div className="container flex flex-col items-center justify-between gap-8 px-4 md:flex-row">
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

      {/* Modals */}
      {showNewGame && <NewGameModal onClose={() => setShowNewGame(false)} />}
      {showJoinGame && <JoinGameModal onClose={() => setShowJoinGame(false)} />}
    </div>
  )
}
