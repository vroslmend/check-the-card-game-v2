"use client";

import { cn } from "@/lib/utils";
import React from "react";

export interface HandGridProps {
  numItems: number;
  children: React.ReactNode;
  className?: string;
  isLocalPlayer: boolean;
  cardToSelect: number | null;
}

export const HandGrid = ({
  numItems,
  children,
  className,
  isLocalPlayer,
  cardToSelect,
}: HandGridProps) => {
  const childrenArray = React.Children.toArray(children);

  const numLandscapeColumns = Math.max(2, Math.ceil(numItems / 2));

  return (
    <div
      className={cn(
        "inline-grid portrait:grid-cols-4 gap-2 max-w-fit",
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${numLandscapeColumns}, minmax(0, 1fr))`,
      }}
    >
      {childrenArray.map((child, index) => (
        <React.Fragment key={`slot-${index}`}>{child}</React.Fragment>
      ))}
    </div>
  );
};
