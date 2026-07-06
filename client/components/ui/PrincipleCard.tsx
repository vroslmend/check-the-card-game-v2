"use client";

import { motion } from "framer-motion";
import { ElementType } from "react";

interface PrincipleCardProps {
  icon: ElementType;
  title: string;
  description: string;
}

// An oversized card face: icon where the rank lives, title beneath — the
// game's cards-as-typography, at marketing scale. Flat at rest, the game's
// hover lift instead of tilt/magnetics.
export function PrincipleCard({
  icon: Icon,
  title,
  description,
}: PrincipleCardProps) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative w-full max-w-[320px]"
    >
      <div className="relative flex h-[300px] flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-surface p-6">
        <Icon className="h-12 w-12 text-ink-muted transition-colors duration-300 group-hover:text-ink" />
        <div className="text-left">
          <h3 className="mb-2 text-2xl font-bold text-ink">{title}</h3>
          <p className="font-normal leading-snug text-ink-muted">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
