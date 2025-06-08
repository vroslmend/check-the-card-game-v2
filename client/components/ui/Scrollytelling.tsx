"use client"

import { useState, useRef } from "react"
import { motion, useScroll, useTransform, useSpring, MotionValue } from "framer-motion"
import { Spade, Heart, Diamond, Droplets, Wind, Zap } from "lucide-react"
import { PrincipleCard } from "@/components/ui/PrincipleCard"
import { CardStack } from "@/components/ui/CardStack"
import { AnimateOnView } from "@/components/ui/AnimateOnView"

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

export function Scrollytelling() {
  const scrollyRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: localScrollYProgress } = useScroll({
    target: scrollyRef,
    offset: ["start start", "end end"]
  });

  const scrollProgress = localScrollYProgress;

  const features = [
    {
      icon: Droplets,
      title: "Seamless UI",
      description: "A clean, intuitive interface that lets you focus on your strategy. No clutter, just pure gameplay.",
    },
    {
      icon: Wind,
      title: "Fluid Animations",
      description: "Every action, from drawing a card to calling 'Check', is accompanied by smooth, satisfying animations.",
    },
    {
      icon: Zap,
      title: "Haptic Feedback",
      description: "Feel the game with subtle vibrations and feedback that make the digital experience feel tangible.",
    },
  ];

  const rules = [
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
  ];

  const continuousActiveCard = useTransform(scrollProgress, [0.75, 0.95], [0, features.length - 1]);
  const smoothContinuousActiveCard = useSpring(continuousActiveCard, {
    stiffness: 100,
    damping: 20,
    mass: 0.5,
  });

  // Principles Title
  const principlesTitleOpacity = useTransform(scrollProgress, [0, 0.05, 0.2, 0.25], [0, 1, 1, 0]);
  const principlesTitleY = useTransform(scrollProgress, [0, 0.05, 0.2, 0.25], ["20%", "0%", "0%", "-20%"]);

  // Principles Cards
  const principlesCardsOpacity = useTransform(scrollProgress, [0.2, 0.25, 0.45, 0.5], [0, 1, 1, 0]);
  const principlesCardsY = useTransform(scrollProgress, [0.2, 0.25, 0.45, 0.5], ["20%", "0%", "0%", "-20%"]);
  const principlesCardsPointerEvents = useTransform(principlesCardsOpacity, (v) => (v > 0 ? "auto" : "none"));

  // Features Title
  const featuresTitleOpacity = useTransform(scrollProgress, [0.45, 0.5, 0.7, 0.75], [0, 1, 1, 0]);
  const featuresTitleY = useTransform(scrollProgress, [0.45, 0.5, 0.7, 0.75], ["20%", "0%", "0%", "-20%"]);
  const featuresTitlePointerEvents = useTransform(featuresTitleOpacity, (v) => (v > 0 ? "auto" : "none"));

  // Features Content
  const featuresContentOpacity = useTransform(scrollProgress, [0.7, 0.75, 0.95, 1.0], [0, 1, 1, 0]);
  const featuresContentY = useTransform(scrollProgress, [0.7, 0.75, 0.95, 1.0], ["20%", "0%", "0%", "-20%"]);
  const featuresContentPointerEvents = useTransform(featuresContentOpacity, (v) => (v > 0 ? "auto" : "none"));
  const cardEntryProgress = useTransform(scrollProgress, [0.7, 0.85], [0, 1]);

  return (
    <section ref={scrollyRef} className="relative h-[700vh]">
      <div id="game-principles-anchor" className="absolute" style={{ top: "20vh" }} />
      <div id="scrollytelling-track" className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* Principles Section */}
        <motion.div
          style={{
            opacity: principlesTitleOpacity,
            y: principlesTitleY,
            pointerEvents: useTransform(principlesTitleOpacity, v => (v > 0 ? "auto" : "none")),
            zIndex: useTransform(principlesTitleOpacity, v => (v > 0 ? 10 : 0)),
          }}
          className="absolute inset-x-0"
        >
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-6 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
              Game Principles
            </h2>
            <p className="mx-auto max-w-2xl text-xl font-light text-stone-600 dark:text-stone-400">
              Elegant rules that create infinite strategic possibilities
            </p>
          </div>
        </motion.div>

        <motion.div
          style={{
            opacity: principlesCardsOpacity,
            y: principlesCardsY,
            pointerEvents: principlesCardsPointerEvents,
            zIndex: useTransform(principlesCardsOpacity, v => (v > 0 ? 10 : 0)),
          }}
          className="absolute inset-x-0"
        >
          <div className="container mx-auto px-4">
            <div className="grid justify-items-center gap-8 lg:grid-cols-3" style={{ perspective: "1000px" }}>
              {rules.map((rule, index) => (
                <PrincipleCard
                  key={index}
                  icon={rule.icon}
                  title={rule.title}
                  description={rule.description}
                  scrollYProgress={localScrollYProgress}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Features Section */}
        <motion.div
          style={{
            opacity: featuresTitleOpacity,
            y: featuresTitleY,
            pointerEvents: featuresTitlePointerEvents,
            zIndex: useTransform(featuresTitleOpacity, v => (v > 0 ? 10 : 0)),
          }}
          className="absolute inset-x-0"
        >
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-light tracking-tight text-stone-900 dark:text-stone-100 sm:text-5xl">
              A more <span className="text-gradient">refined</span> experience
            </h2>
          </div>
        </motion.div>

        <motion.div
          style={{
            opacity: featuresContentOpacity,
            y: featuresContentY,
            pointerEvents: featuresContentPointerEvents,
            zIndex: useTransform(featuresContentOpacity, v => (v > 0 ? 10 : 0)),
          }}
          className="absolute h-full w-full"
        >
          <div className="container mx-auto grid h-full w-full grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex flex-col items-center justify-center gap-12 py-24">
              {features.map((feature, index) => (
                <FeatureItem
                  key={index}
                  index={index}
                  feature={feature}
                  continuousActiveCard={smoothContinuousActiveCard}
                />
              ))}
            </div>
            <div className="flex h-full items-center justify-center">
              <div className="w-full">
                <CardStack
                  features={features}
                  continuousActiveCard={smoothContinuousActiveCard}
                  cardEntryProgress={cardEntryProgress}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
} 