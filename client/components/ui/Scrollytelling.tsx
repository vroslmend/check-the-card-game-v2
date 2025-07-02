"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";
import { FaBrain, FaEye } from "react-icons/fa";
import { GiWhirlwind } from "react-icons/gi";
import { PrincipleCard } from "@/components/ui/PrincipleCard";
import { AnimateOnView } from "@/components/ui/AnimateOnView";
import { useDevice } from "@/context/DeviceContext";
import { Spade, Heart, Diamond } from "lucide-react";

const features = [
  {
    icon: FaBrain,
    title: "Master Your Memory",
    description:
      "Keep track of your cards and your opponents'. A sharp memory is your greatest weapon.",
  },
  {
    icon: GiWhirlwind,
    title: "Unleash Chaos",
    description:
      "Use special abilities from Jacks, Queens, and Kings to peek, swap, and disrupt your way to victory.",
  },
  {
    icon: FaEye,
    title: "Call Their Bluff",
    description:
      "Think you have the lowest score? Call 'Check' to end the round, but be careful—a wrong move could cost you the game.",
  },
];

const rules = [
  {
    icon: Spade,
    title: "Lowest Score Wins",
    description:
      "The goal is simple: have the lowest total score at the end of the round. Every card counts.",
  },
  {
    icon: Heart,
    title: "Know Your Hand",
    description:
      "You only get to see two of your cards at the start. From then on, it's all about memory and deduction.",
  },
  {
    icon: Diamond,
    title: "Powers and Abilities",
    description:
      "Leverage the special powers of face cards to peek at, swap, and manipulate the game to your advantage.",
  },
];

interface FeatureCardProps {
  feature: (typeof features)[0];
  i: number;
  scrollXProgress: any;
  isMobile: boolean;
}

const FeatureCard = ({
  feature,
  i,
  scrollXProgress,
  isMobile,
}: FeatureCardProps) => {
  const numFeatures = features.length;
  const scale = useTransform(
    scrollXProgress,
    [
      (i - 1) / (numFeatures - 1),
      i / (numFeatures - 1),
      (i + 1) / (numFeatures - 1),
    ],
    isMobile ? [1, 1, 1] : [0.6, 1, 0.6],
  );

  const rotate = useTransform(
    scrollXProgress,
    [
      (i - 1) / (numFeatures - 1),
      i / (numFeatures - 1),
      (i + 1) / (numFeatures - 1),
    ],
    isMobile ? [0, 0, 0] : [-20, 0, 20],
  );

  const opacity = useTransform(
    scrollXProgress,
    [
      (i - 1) / (numFeatures - 1),
      i / (numFeatures - 1),
      (i + 1) / (numFeatures - 1),
    ],
    isMobile ? [1, 1, 1] : [0.3, 1, 0.3],
  );

  const textOpacity = useTransform(
    scrollXProgress,
    [
      (i - 0.5) / (numFeatures - 1),
      i / (numFeatures - 1),
      (i + 0.5) / (numFeatures - 1),
    ],
    [0, 1, 0],
  );

  return (
    <motion.div
      style={{
        scale: isMobile ? 1 : scale,
        rotateY: isMobile ? 0 : rotate,
        opacity,
      }}
      className="relative w-full h-[350px] bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl p-8 flex flex-col justify-between"
    >
      <div>
        <feature.icon className="w-10 h-10 mb-4 text-stone-500" />
        <h3 className="text-3xl font-light text-stone-900 dark:text-stone-100">
          {feature.title}
        </h3>
      </div>
      <motion.p
        style={{ opacity: isMobile ? 1 : textOpacity }}
        className="text-lg font-light text-stone-600 dark:text-stone-400"
      >
        {feature.description}
      </motion.p>
    </motion.div>
  );
};

function DesktopScrollytelling() {
  const { isMobile } = useDevice();

  // Ref and scroll progress for the Principles Title
  const principlesTitleRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: principlesTitleScrollYProgress } = useScroll({
    target: principlesTitleRef,
    offset: ["start end", "end start"],
  });

  // Ref and scroll progress for the Principles Cards
  const principlesCardsRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: principlesCardsScrollYProgress } = useScroll({
    target: principlesCardsRef,
    offset: ["start end", "end start"],
  });

  // Ref and scroll progress for the Features Carousel
  const featuresContainerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: featuresScrollYProgress } = useScroll({
    target: featuresContainerRef,
    offset: ["start start", "end end"],
  });

  // Animation for Principles Title
  const principlesTitleOpacity = useTransform(
    principlesTitleScrollYProgress,
    [0, 0.2, 0.8, 1],
    [0, 1, 1, 0],
  );
  const principlesTitleY = useTransform(
    principlesTitleScrollYProgress,
    [0, 0.2, 0.8, 1],
    [20, 0, 0, -20],
  );

  // Animation for Principles Cards
  const principlesCardsOpacity = useTransform(
    principlesCardsScrollYProgress,
    [0, 0.2, 0.8, 1],
    [0, 1, 1, 0],
  );
  const principlesCardsY = useTransform(
    principlesCardsScrollYProgress,
    [0, 0.2, 0.8, 1],
    [20, 0, 0, -20],
  );

  const carouselProgress = useTransform(
    featuresScrollYProgress,
    [0.1, 0.2, 0.8, 0.9],
    [-0.5, 0, 1, 1.5],
  );

  const animatedX = useTransform(
    carouselProgress,
    [-0.5, 0, 1, 1.5],
    ["100vw", "25vw", "-75vw", "-150vw"],
  );

  const smoothAnimatedX = useSpring(animatedX, {
    stiffness: 200,
    damping: 40,
  });

  return (
    <section id="features" className="relative py-32">
      <div
        id="game-principles-anchor"
        className="absolute"
        style={{ top: "20vh" }}
      />
      <div className="container mx-auto px-4 space-y-32">
        {/* Principles Section */}
        <div ref={principlesTitleRef} style={{ height: "120vh" }}>
          <div className="sticky top-1/2 -translate-y-1/2">
            <motion.div
              style={{ opacity: principlesTitleOpacity, y: principlesTitleY }}
              className="text-center"
            >
              <h2 className="mb-6 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
                The Art of the Game
              </h2>
              <p className="mx-auto max-w-2xl text-xl font-light text-stone-600 dark:text-stone-400">
                Simple rules give rise to complex strategies.
              </p>
            </motion.div>
          </div>
        </div>

        <div ref={principlesCardsRef} style={{ height: "120vh" }}>
          <div className="sticky top-1/2 -translate-y-1/2">
            <motion.div
              style={{ opacity: principlesCardsOpacity, y: principlesCardsY }}
            >
              <div className="grid justify-items-center gap-8 lg:grid-cols-3">
                {rules.map((rule, index) => (
                  <PrincipleCard
                    key={index}
                    icon={rule.icon}
                    title={rule.title}
                    description={rule.description}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Features Section */}
        <div className="relative h-[300vh]" ref={featuresContainerRef}>
          <div className="sticky top-1/4 left-0 overflow-hidden">
            <AnimateOnView className="text-center mb-16">
              <h2 className="mb-6 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
                Built for Strategy
              </h2>
              <p className="mx-auto max-w-2xl text-xl font-light text-stone-600 dark:text-stone-400">
                Every card holds the potential for a game-changing move.
              </p>
            </AnimateOnView>

            <div
              style={{
                maskImage:
                  "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
              }}
            >
              <motion.div
                style={{ x: smoothAnimatedX }}
                className="flex items-center gap-8"
              >
                {features.map((feature, i) => (
                  <div key={i} className="min-w-[50vw]">
                    <FeatureCard
                      i={i}
                      feature={feature}
                      scrollXProgress={carouselProgress}
                      isMobile={isMobile}
                    />
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileScrollytelling() {
  return (
    <section id="features" className="relative py-32">
      <div
        id="game-principles-anchor"
        className="absolute"
        style={{ top: "20vh" }}
      />
      <div className="container mx-auto px-4 space-y-24">
        {/* Principles Section */}
        <AnimateOnView className="text-center">
          <h2 className="mb-6 text-5xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
            The Art of the Game
          </h2>
          <p className="mx-auto max-w-2xl text-lg font-light text-stone-600 dark:text-stone-400">
            Simple rules give rise to complex strategies.
          </p>
        </AnimateOnView>

        <AnimateOnView>
          <div className="grid justify-items-center gap-8 md:grid-cols-3">
            {rules.map((rule, index) => (
              <PrincipleCard
                key={index}
                icon={rule.icon}
                title={rule.title}
                description={rule.description}
              />
            ))}
          </div>
        </AnimateOnView>

        {/* Features Section */}
        <div className="space-y-16">
          <AnimateOnView className="text-center">
            <h2 className="mb-6 text-5xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
              Built for Strategy
            </h2>
            <p className="mx-auto max-w-2xl text-lg font-light text-stone-600 dark:text-stone-400">
              Every card holds the potential for a game-changing move.
            </p>
          </AnimateOnView>

          <div className="flex flex-col gap-12">
            {features.map((feature, i) => (
              <AnimateOnView
                key={i}
                className="bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl p-8"
              >
                <div>
                  <feature.icon className="w-10 h-10 mb-4 text-stone-500" />
                  <h3 className="text-3xl font-light text-stone-900 dark:text-stone-100">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-lg font-light text-stone-600 dark:text-stone-400 mt-4">
                  {feature.description}
                </p>
              </AnimateOnView>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Scrollytelling() {
  const { isMobile } = useDevice();
  if (isMobile) {
    return <MobileScrollytelling />;
  }
  return <DesktopScrollytelling />;
}
