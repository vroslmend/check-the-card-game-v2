"use client";

import {
  motion,
  useTransform,
  useSpring,
  useTime,
  type MotionValue,
  AnimatePresence,
} from "framer-motion";
import { Spade, Heart, Diamond, Club } from "lucide-react";
import { useMemo, useState, useEffect, FC } from "react";
import { FloatingSuitIcon } from "./FloatingSuitIcon";
import { AnimatedBlob } from "./AnimatedBlob";
import { useTheme } from "next-themes";

interface SmoothFloatingElementsProps {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  isVisible: boolean;
  isCheckHovered: boolean;
  shouldReduceMotion: boolean;
}

const suitConfigs = [
  {
    Icon: Spade,
    x: -160,
    y: -220,
    rotate: -15,
    startX: -30,
    startY: -60,
    z: -50,
  },
  { Icon: Heart, x: 100, y: -200, rotate: 15, startX: 30, startY: -60, z: -50 },
  {
    Icon: Diamond,
    x: -160,
    y: 220,
    rotate: 15,
    startX: -30,
    startY: 60,
    z: -50,
  },
  { Icon: Club, x: 120, y: 200, rotate: -15, startX: 30, startY: 60, z: -50 },
];

interface SuitProps {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  isCheckHovered: boolean;
  config: (typeof suitConfigs)[0];
  delay: number;
  shouldReduceMotion: boolean;
}

const Suit: FC<SuitProps> = ({
  mouseX,
  mouseY,
  isCheckHovered,
  config,
  delay,
  shouldReduceMotion,
}) => {
  const { theme } = useTheme();
  const popOut = useSpring(0, { stiffness: 100, damping: 15 });

  useEffect(() => {
    const timer = setTimeout(
      () => popOut.set(isCheckHovered ? 1 : 0),
      (isCheckHovered ? delay : 0) * 1000,
    );
    return () => clearTimeout(timer);
  }, [isCheckHovered, popOut, delay]);

  const time = useTime();
  const idleY = useTransform(time, (t) =>
    shouldReduceMotion ? 0 : Math.sin(t / 1000 + delay * 10) * 5,
  );
  const swivel = useTransform(time, (t) =>
    shouldReduceMotion ? 0 : Math.sin(t / 1200 + delay * 8) * 15,
  );

  // Parallax transforms
  const paraX = useTransform(
    mouseX,
    [-1, 1],
    shouldReduceMotion ? [0, 0] : [-15, 15],
  );
  const paraY = useTransform(
    mouseY,
    [-1, 1],
    shouldReduceMotion ? [0, 0] : [-15, 15],
  );

  // Pop-out transform from start to end positions
  const popOutX = useTransform(popOut, [0, 1], [config.startX, config.x]);
  const popOutY = useTransform(popOut, [0, 1], [config.startY, config.y]);

  // Scale idle animation with popOut value
  const scaledIdleY = useTransform(
    [popOut, idleY],
    (latest) => (latest[0] as number) * (latest[1] as number),
  );

  // Combined position transforms
  const x = useTransform(
    [popOutX, paraX],
    (latest) => (latest[0] as number) + (latest[1] as number),
  );
  const y = useTransform(
    [popOutY, paraY, scaledIdleY],
    (latest) =>
      (latest[0] as number) + (latest[1] as number) + (latest[2] as number),
  );

  // Other property transforms
  const scale = useTransform(popOut, [0, 1], [0.5, 1.1]);
  const opacity = popOut;
  const z = useTransform(popOut, [0, 1], [0, config.z]);

  const rotate = useTransform([popOut, swivel], (latest) => {
    const p = latest[0] as number;
    const s = latest[1] as number;
    return p * config.rotate + p * s;
  });

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 flex h-16 w-16 items-center justify-center rounded-2xl backdrop-blur-sm"
      style={{ x, y, scale, opacity, rotate, z }}
      whileHover={{
        scale: shouldReduceMotion ? 1 : 1.2,
        transition: { duration: 0.2 },
      }}
    >
      <FloatingSuitIcon Icon={config.Icon} />
    </motion.div>
  );
};

export function SmoothFloatingElements({
  mouseX,
  mouseY,
  isVisible,
  isCheckHovered,
  shouldReduceMotion,
}: SmoothFloatingElementsProps) {
  const { theme } = useTheme();
  const [currentSuitConfigs, setCurrentSuitConfigs] = useState(suitConfigs);

  const RANDOMNESS_FACTOR = 80;

  useEffect(() => {
    if (isCheckHovered && !shouldReduceMotion) {
      const newConfigs = suitConfigs.map((config) => ({
        ...config,
        x: config.x + (Math.random() - 0.5) * RANDOMNESS_FACTOR,
        y: config.y + (Math.random() - 0.5) * RANDOMNESS_FACTOR,
      }));
      setCurrentSuitConfigs(newConfigs);
    }
  }, [isCheckHovered, shouldReduceMotion]);
  const suits = [Spade, Heart, Diamond, Club];
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    // Disabled decorative particles for cleaner background
    setParticles([]);
    /*
    if (shouldReduceMotion) {
      setParticles([]);
      return;
    }
    setParticles(
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        style: {
          left: `${15 + Math.random() * 70}%`,
          top: `${15 + Math.random() * 70}%`,
        },
        animation: {
          y: [0, -25, 0],
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.2, 1],
        },
        duration: 4 + i * 0.3,
        delay: i * 0.4,
      })),
    );
    */
  }, [shouldReduceMotion]);

  // Smooth mouse tracking
  const smoothMouseX = useSpring(mouseX, { stiffness: 150, damping: 30 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 150, damping: 30 });

  // Central shape transforms
  const centralRotateX = useTransform(
    smoothMouseY,
    [-1, 1],
    shouldReduceMotion ? [0, 0] : [-8, 8],
  );
  const centralRotateY = useTransform(
    smoothMouseX,
    [-1, 1],
    shouldReduceMotion ? [0, 0] : [-8, 8],
  );

  // Parallax for suits and particles
  const particleX = useTransform(
    smoothMouseX,
    [-1, 1],
    shouldReduceMotion ? [0, 0] : [30, -30],
  );
  const particleY = useTransform(
    smoothMouseY,
    [-1, 1],
    shouldReduceMotion ? [0, 0] : [30, -30],
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        scale: isVisible ? 1 : 0.9,
      }}
      transition={{ duration: 1.5, ease: [0.6, 0.01, 0.05, 0.95] }}
      className="relative h-full w-full will-change-transform"
    >
      {/* Central Interactive Blob/Card */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center -mt-16"
        style={{
          rotateX: centralRotateX,
          rotateY: centralRotateY,
          willChange: "transform",
        }}
      >
        <AnimatePresence initial={false} mode="wait">
          {!isCheckHovered ? (
            // Blob State
            <motion.div
              key="blob"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: 1,
                transition: { duration: 0.4, ease: "easeInOut" },
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                transition: { duration: 0.4, ease: "easeInOut" },
              }}
            >
              <AnimatedBlob />
            </motion.div>
          ) : (
            // Card State Container
            <motion.div
              key="card-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.1 } }}
              exit={{ opacity: 0, transition: { duration: 0.5 } }}
              style={{
                perspective: "1000px",
                transformStyle: "preserve-3d",
              }}
            >
              {/* Floating card suits */}
              {currentSuitConfigs.map((config, index) => (
                <Suit
                  key={index}
                  mouseX={smoothMouseX}
                  mouseY={smoothMouseY}
                  isCheckHovered={isCheckHovered}
                  config={config}
                  delay={0.4 + index * 0.1}
                  shouldReduceMotion={shouldReduceMotion}
                />
              ))}
              {/* Card State */}
              <motion.div
                key="card"
                className="relative"
                initial={{
                  opacity: 0,
                  scale: 0.8,
                  rotateY: shouldReduceMotion ? 0 : 180,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotateY: 0,
                  rotateZ: shouldReduceMotion
                    ? 0
                    : [0, 1.5, -1.5, 1.5, -1.5, 0],
                  y: shouldReduceMotion ? 0 : [0, -6, 0],
                }}
                exit={{
                  opacity: 0,
                  scale: 0.8,
                  rotateY: shouldReduceMotion ? 0 : 180,
                  transition: { duration: 0.4, ease: "easeInOut" },
                }}
                transition={{
                  opacity: { duration: 0.5, ease: "easeInOut" },
                  scale: { duration: 0.5, ease: "easeInOut" },
                  rotateY: {
                    duration: shouldReduceMotion ? 0 : 0.5,
                    ease: "easeInOut",
                  },
                  rotateZ: {
                    duration: 15,
                    repeat: shouldReduceMotion ? 0 : Infinity,
                    ease: "easeInOut",
                    delay: 0.7,
                  },
                  y: {
                    duration: 10,
                    repeat: shouldReduceMotion ? 0 : Infinity,
                    ease: "easeInOut",
                    delay: 0.7,
                  },
                }}
              >
                {/* Card Back (initially visible) */}
                <motion.div
                  className="absolute inset-0 h-80 w-56 rounded-lg border-2 border-stone-200 bg-gradient-to-br from-stone-100 to-stone-200/60 shadow-xl dark:border-stone-800 dark:from-stone-800 dark:to-stone-900/60"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  {/* Card Back Pattern */}
                  <div className="absolute inset-4 rounded border border-stone-300/30 dark:border-stone-700/30">
                    <div className="flex h-full items-center justify-center">
                      <div className="font-serif text-lg font-light italic text-stone-600/50 dark:text-stone-400/50">
                        Check
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Card Front (Ace of Spades) */}
                <motion.div
                  className="h-80 w-56 rounded-lg border-2 border-stone-200 bg-stone-50 shadow-xl dark:border-stone-800 dark:bg-stone-900"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  {/* Ace of Spades Content */}
                  <div className="relative flex h-full flex-col justify-between p-4">
                    {/* Top Left */}
                    <motion.div
                      className="font-serif text-xl font-light text-stone-900 dark:text-stone-100"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <div>A</div>
                      <div className="text-lg leading-none">♠</div>
                    </motion.div>

                    {/* Center Large Spade */}
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center text-8xl font-light text-stone-900 dark:text-stone-100"
                      initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{
                        delay: 0.4,
                        duration: 0.6,
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                      }}
                    >
                      ♠
                    </motion.div>

                    {/* Bottom Right (Rotated) */}
                    <motion.div
                      className="self-end rotate-180 font-serif text-xl font-light text-stone-900 dark:text-stone-100"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <div>A</div>
                      <div className="text-lg leading-none">♠</div>
                    </motion.div>
                  </div>

                  {/* Card Glow Effect */}
                  {theme === "dark" && (
                    <motion.div
                      className="absolute -inset-2 rounded-lg bg-gradient-to-r from-white/20 via-white/30 to-white/20 blur-xl dark:from-stone-100/10 dark:via-stone-100/20 dark:to-stone-100/10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                    />
                  )}
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Optimized particles */}
      <motion.div style={{ x: particleX, y: particleY }}>
        {/* decorative particle dots removed */}
      </motion.div>

      {/* Subtle glow effect */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-stone-300/10 to-stone-400/10 blur-3xl dark:from-stone-600/10 dark:to-stone-700/10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}
