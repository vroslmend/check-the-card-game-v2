'use client';

import { useRef, useState } from 'react'
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MagneticProps {
  children: ReactNode;
  strength?: number; 
  className?: string;
}

export default function Magnetic({ children, strength = 20, className }: MagneticProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({x:0,y:0});

    const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
        const { clientX, clientY } = e;
        if (ref.current) {
            const {height, width, left, top} = ref.current.getBoundingClientRect();
            const factor = 0.005 * strength;
            const middleX = (clientX - (left + width/2)) * factor;
            const middleY = (clientY - (top + height/2)) * factor;
            setPosition({x: middleX, y: middleY})
        }
    }

    const throttle = (func: (e: React.MouseEvent<HTMLDivElement>) => void, limit: number) => {
      let inThrottle: boolean;
      return function (this: any, e: React.MouseEvent<HTMLDivElement>) {
        const context = this;
        if (!inThrottle) {
          func.apply(context, [e]);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    };

    const throttledMouseMove = throttle(handleMouse, 16);

    const reset = () => {
        setPosition({x:0, y:0})
    }

    const { x, y } = position;
    return (
        <motion.div
            className={className}
            style={{position: "relative"}}
            ref={ref}
            onMouseMove={throttledMouseMove}
            onMouseLeave={reset}
            animate={{x, y}}
            transition={{type: "spring", stiffness: 250, damping: 20, mass: 0.5}}
        >
            {children}
        </motion.div>
    )
} 