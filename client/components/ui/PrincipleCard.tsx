"use client";

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  MotionValue,
} from "framer-motion";
import { ElementType, useRef } from "react";
import Magnetic from "@/components/ui/Magnetic";
import { useDevice } from "@/context/DeviceContext";

interface PrincipleCardProps {
  icon: ElementType;
  title: string;
  description: string;
}

export function PrincipleCard({
  icon: Icon,
  title,
  description,
}: PrincipleCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { isMobile } = useDevice();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const xSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const ySpring = useSpring(y, { stiffness: 150, damping: 20 });

  const rotateX = useTransform(ySpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(xSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const mouseX = e.clientX - left;
    const mouseY = e.clientY - top;
    x.set((mouseX - width / 2) / (width / 2));
    y.set((mouseY - height / 2) / (height / 2));
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const cardContent = (
    <motion.div
      ref={ref}
      onMouseMove={!isMobile ? handleMouseMove : undefined}
      onMouseLeave={!isMobile ? handleMouseLeave : undefined}
      whileHover={
        !isMobile
          ? {
              scale: 1.05,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0)",
            }
          : {}
      }
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="group relative w-full max-w-[320px]"
    >
      <div
        style={{
          transform: "translateZ(80px)",
          transformStyle: "preserve-3d",
        }}
        className="relative h-[300px] overflow-hidden rounded-2xl border border-stone-200/50 bg-white p-6 shadow-lg transition-colors duration-500 group-hover:bg-stone-50 dark:border-stone-800/50 dark:bg-stone-950 dark:group-hover:bg-stone-900"
      >
        <motion.div
          style={{ transform: "translateZ(50px)" }}
          className="absolute top-6 left-6"
        >
          <div className="inline-flex items-center justify-center">
            <Icon className="h-12 w-12 text-stone-400 transition-colors duration-500 group-hover:text-stone-900 dark:text-stone-600 dark:group-hover:text-stone-100" />
          </div>
        </motion.div>

        <div className="flex h-full flex-col items-start justify-end text-left">
          <motion.h3
            style={{ transform: "translateZ(40px)" }}
            className="mb-2 font-serif text-2xl text-stone-900 dark:text-stone-100"
          >
            {title}
          </motion.h3>
          <motion.p
            style={{ transform: "translateZ(30px)" }}
            className="font-light leading-snug text-stone-600 dark:text-stone-400"
          >
            {description}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="relative">
      {!isMobile ? <Magnetic>{cardContent}</Magnetic> : cardContent}
    </div>
  );
}
