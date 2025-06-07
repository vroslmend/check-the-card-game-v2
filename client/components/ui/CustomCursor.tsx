'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue, Variants } from 'framer-motion';
import { useCursorStore } from '@/store/cursorStore';
import { useTheme } from 'next-themes';

const CustomCursor = () => {
  const { variant, setVariant } = useCursorStore();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const previousVariant = useRef('default');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Dynamically create variants based on the current theme
  const getCursorVariants = (theme: string | undefined): Variants => {
    const isDark = theme === 'dark';
    const fg = isDark ? 'hsl(60 9% 98%)' : 'hsl(20 14% 8%)';
    const fgText = isDark ? 'hsl(60 9% 98%)' : 'hsl(20 14% 8%)';

    return {
      default: {
        height: 32,
        width: 32,
        backgroundColor: `${fg.slice(0, -1)} / 0.1)`,
        borderColor: fg,
        borderWidth: '1px',
        scale: 1,
      },
      link: {
        height: 48,
        width: 48,
        backgroundColor: `${fg.slice(0, -1)} / 0.2)`,
        borderColor: fg,
        borderWidth: '1px',
        scale: 1,
      },
      text: {
        height: 40,
        width: 2,
        borderRadius: '1px',
        backgroundColor: fgText,
        borderColor: fgText,
        borderWidth: '1px',
        mixBlendMode: 'difference',
      },
      pressed: {
        scale: 0.9,
        backgroundColor: `${fg.slice(0, -1)} / 0.3)`,
      },
      button: {
        height: 80,
        width: 80,
        backgroundColor: `${fg.slice(0, -1)} / 0.2)`,
        borderColor: fg,
        borderWidth: '1px',
      }
    };
  };

  const cursorVariants = getCursorVariants(resolvedTheme);

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
  
  if (!mounted) {
    return null;
  }

  return (
    <div key={resolvedTheme} className="fixed inset-0 pointer-events-none z-50">
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