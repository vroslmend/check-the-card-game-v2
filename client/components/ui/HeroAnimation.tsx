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

interface HeroAnimationProps {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
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

const SuitFC: FC<{
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
  isCheckHovered: boolean;
  config: (typeof suitConfigs)[0];
  delay: number;
  shouldReduceMotion: boolean;
}> = ({
  mouseX,
  mouseY,
  isCheckHovered,
  config,
  delay,
  shouldReduceMotion,
}) => {
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
  const popOutX = useTransform(popOut, [0, 1], [config.startX, config.x]);
  const popOutY = useTransform(popOut, [0, 1], [config.startY, config.y]);
  const scaledIdleY = useTransform(
    [popOut, idleY],
    (latest) => (latest[0] as number) * (latest[1] as number),
  );
  const x = useTransform(
    [popOutX, paraX],
    (latest) => (latest[0] as number) + (latest[1] as number),
  );
  const y = useTransform(
    [popOutY, paraY, scaledIdleY],
    (latest) =>
      (latest[0] as number) + (latest[1] as number) + (latest[2] as number),
  );
  const scale = useTransform(popOut, [0, 1], [0.5, 1.1]);
  const opacity = popOut;
  const z = useTransform(popOut, [0, 1], [0, config.z]);
  const rotate = useTransform(
    [popOut, swivel],
    (latest) =>
      (latest[0] as number) * config.rotate +
      (latest[0] as number) * (latest[1] as number),
  );

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

export function HeroAnimation({
  mouseX,
  mouseY,
  isCheckHovered,
  shouldReduceMotion,
}: HeroAnimationProps) {
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

  const smoothMouseX = useSpring(mouseX, { stiffness: 150, damping: 30 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 150, damping: 30 });
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

  return (
    <motion.div
      className="relative flex items-center justify-center w-full h-full"
      style={{
        rotateX: centralRotateX,
        rotateY: centralRotateY,
        willChange: "transform",
      }}
    >
      <AnimatePresence mode="wait">
        {!isCheckHovered ? (
          <motion.div
            key="blob"
            className="-translate-y-16"
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
          <motion.div
            key="card-container"
            className="-translate-y-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
          >
            {currentSuitConfigs.map((config, index) => (
              <SuitFC
                key={index}
                mouseX={smoothMouseX}
                mouseY={smoothMouseY}
                isCheckHovered={isCheckHovered}
                config={config}
                delay={0.4 + index * 0.1}
                shouldReduceMotion={shouldReduceMotion}
              />
            ))}
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
                rotateZ: shouldReduceMotion ? 0 : [0, 1.5, -1.5, 1.5, -1.5, 0],
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
              <motion.div
                className="absolute inset-0 h-80 w-56 rounded-lg border-2 border-stone-200 bg-gradient-to-br from-stone-100 to-stone-200/60 shadow-xl dark:border-stone-800 dark:from-stone-800 dark:to-stone-900/60"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="absolute inset-4 rounded border border-stone-300/30 dark:border-stone-700/30">
                  <div className="flex h-full items-center justify-center">
                    <div className="font-serif text-lg font-light italic text-stone-600/50 dark:text-stone-400/50">
                      Check
                    </div>
                  </div>
                </div>
              </motion.div>
              <motion.div
                className="h-80 w-56 rounded-lg border-2 border-stone-200 bg-stone-50 shadow-xl dark:border-stone-800 dark:bg-stone-900"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="relative flex h-full flex-col justify-between p-4">
                  <motion.div
                    className="font-serif text-xl font-light text-stone-900 dark:text-stone-100"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                  >
                    <div>A</div>
                    <div className="text-lg leading-none">♠</div>
                  </motion.div>
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
  );
}
