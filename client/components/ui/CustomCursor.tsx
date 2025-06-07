'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useSpring, useMotionValue, Variants } from 'framer-motion';
import { useCursorStore } from '@/store/cursorStore';

const cursorVariants: Variants = {
  default: {
    height: 32,
    width: 32,
    backgroundColor: 'hsla(var(--foreground), 0.1)',
    borderColor: 'hsl(var(--foreground))',
    borderWidth: '1px',
    scale: 1,
  },
  link: {
    height: 48,
    width: 48,
    backgroundColor: 'hsla(var(--foreground), 0.2)',
    borderColor: 'hsl(var(--foreground))',
    borderWidth: '1px',
    scale: 1,
  },
  text: {
    height: 40,
    width: 2,
    borderRadius: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'white',
    borderWidth: '1px',
    mixBlendMode: 'difference',
  },
  pressed: {
    scale: 0.9,
    backgroundColor: 'hsla(var(--foreground), 0.3)',
  },
  button: {
    height: 80,
    width: 80,
    backgroundColor: 'hsla(var(--foreground), 0.2)',
    borderColor: 'hsl(var(--foreground))',
    borderWidth: '1px',
  }
};

const CustomCursor = () => {
  const { variant, setVariant } = useCursorStore();
  const previousVariant = useRef('default');

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  const springConfig = { damping: 40, stiffness: 350, mass: 0.7 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);

      const target = e.target as HTMLElement;
      if (target.matches('a, button, [role="button"], [data-clickable]')) {
        if (variant !== 'link' && variant !== 'pressed') {
          setVariant('link');
        }
      } else {
        if (variant !== 'default' && variant !== 'pressed') {
          setVariant('default');
        }
      }
    };

    const handleMouseDown = () => {
      previousVariant.current = useCursorStore.getState().variant;
      setVariant('pressed');
    };
    
    const handleMouseUp = () => {
      setVariant(previousVariant.current as any);
    };

    const unsubscribe = useCursorStore.subscribe(
      (state, prevState) => {
        if (state.variant !== 'pressed' && state.variant !== prevState.variant) {
          previousVariant.current = state.variant;
        }
      }
    );

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      unsubscribe();
    };
  }, [mouseX, mouseY, setVariant, variant]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <motion.div
        variants={cursorVariants}
        animate={variant}
        style={{
          translateX: springX,
          translateY: springY,
        }}
        className="fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
    </div>
  );
};

export default CustomCursor; 