"use client";

import { cn } from "@/lib/utils";
import React from "react";

export interface HandGridProps {
  numItems: number;
  children: React.ReactNode;
  className?: string;
}

export const HandGrid = ({ numItems, children, className }: HandGridProps) => {
  // 2x2 for the standard four-card hand; grows a column per two extra cards
  // (penalty cards from failed match attempts). The floor is one column, not
  // two: a hand collapsed to a single vertical pair keeps its vertical shape
  // instead of re-wrapping into a row.
  const numColumns = Math.max(1, Math.ceil(numItems / 2));

  return (
    <div
      className={cn("inline-grid gap-2 max-w-fit", className)}
      style={{
        gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`,
      }}
    >
      {children}
    </div>
  );
};
