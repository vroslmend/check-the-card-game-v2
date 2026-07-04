"use client";

import { Check } from "lucide-react";

interface CardBackProps {
  /** When set (deck stock pile), the count renders instead of the mark. */
  count?: number;
}

export function CardBack({ count }: CardBackProps) {
  return (
    <div className="relative w-full h-full rounded-card bg-accent flex items-center justify-center overflow-hidden @container/back">
      {typeof count === "number" ? (
        <span className="card-back-count font-game font-bold leading-none text-accent-ink">
          {count}
        </span>
      ) : (
        <Check className="w-[22%] h-[22%] text-accent-ink" strokeWidth={3} />
      )}
    </div>
  );
}
