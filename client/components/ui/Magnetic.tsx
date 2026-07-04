"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

export default function Magnetic({
  children,
  strength = 20,
  className,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastMoveRef = useRef(0);
  // While a press is in progress the element must stay put: if it keeps
  // spring-following the cursor between pointerdown and pointerup, the
  // release can land outside the moved element and the click never fires
  // (this made lobby buttons need two presses).
  const pressedRef = useRef(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Touch taps fire pointer/mouse-move without a matching leave, which
    // left the element stuck displaced. Magnetic pull is mouse-only.
    if (e.pointerType !== "mouse") return;
    if (pressedRef.current) return;
    const now = performance.now();
    if (now - lastMoveRef.current < 16) return;
    lastMoveRef.current = now;

    const { clientX, clientY } = e;
    if (ref.current) {
      const { height, width, left, top } = ref.current.getBoundingClientRect();
      const factor = 0.005 * strength;
      const middleX = (clientX - (left + width / 2)) * factor;
      const middleY = (clientY - (top + height / 2)) * factor;
      setPosition({ x: middleX, y: middleY });
    }
  };

  const handlePointerDown = () => {
    pressedRef.current = true;
  };

  const handlePointerUp = () => {
    pressedRef.current = false;
  };

  const reset = () => {
    pressedRef.current = false;
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;
  return (
    <motion.div
      className={className}
      style={{ position: "relative" }}
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={reset}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 250, damping: 20, mass: 0.5 }}
    >
      {children}
    </motion.div>
  );
}
