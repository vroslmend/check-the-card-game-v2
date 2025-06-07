"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const cardVariants = {
  initial: { y: 0, rotate: 0, scale: 1, opacity: 1 },
  hover: {
    y: [0, -2, 0],
    rotate: [0, 2, -2, 0],
    scale: 1.05,
    transition: { duration: 0.5, repeat: Infinity, repeatType: "mirror" as const },
  },
};

const textVariants = {
  rest: {
    color: "hsl(var(--foreground))",
    x: 0,
    transition: { duration: 0.3 }
  },
  hover: {
    color: "hsl(var(--primary))",
    x: "2%",
    transition: { duration: 0.3 }
  }
}

export function AnimatedLogo({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn("flex items-center gap-1 text-2xl font-bold tracking-tighter cursor-pointer", className)}
      initial="rest"
      whileHover="hover"
      animate="rest"
      data-cursor-link
    >
      <motion.span variants={textVariants}>C</motion.span>
      <motion.span variants={textVariants}>H</motion.span>
      <motion.span variants={textVariants}>E</motion.span>
      <motion.div variants={cardVariants}>
        <span className="text-primary">C</span>
      </motion.div>
      <motion.span variants={textVariants}>K</motion.span>
      <motion.span variants={textVariants}>!</motion.span>
    </motion.div>
  );
} 