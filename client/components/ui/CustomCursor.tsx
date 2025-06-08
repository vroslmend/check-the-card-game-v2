'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useSpring, useMotionValue, Variants } from 'framer-motion';
import { useCursorStore } from '@/store/cursorStore';
import { useTheme } from 'next-themes';

const CustomCursor = () => {
  const { variant, setVariant } = useCursorStore();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isPointerInViewport, setIsPointerInViewport] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const previousVariant = useRef('default');
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getCursorVariants = (theme: string | undefined): Variants => {
    const isDark = theme === 'dark';
    const fg = isDark ? 'hsl(60 9% 98%)' : 'hsl(20 14% 8%)';
    const fgText = isDark ? 'hsl(60 9% 98%)' : 'hsl(20 14% 8%)';

    return {
      hidden: {
        opacity: 0,
        scale: 0.8,
        transition: {
          duration: 0.3,
          ease: 'easeOut',
        },
      },
      default: {
        opacity: 1,
        scale: 1,
        height: 32,
        width: 32,
        backgroundColor: `${fg.slice(0, -1)} / 0.1)`,
        borderColor: fg,
        borderWidth: '1px',
      },
      link: {
        opacity: 1,
        scale: 1,
        height: 48,
        width: 48,
        backgroundColor: `${fg.slice(0, -1)} / 0.2)`,
        borderColor: fg,
        borderWidth: '1px',
      },
      text: {
        opacity: 1,
        scale: 1,
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
        opacity: 1,
        scale: 1,
        height: 80,
        width: 80,
        backgroundColor: `${fg.slice(0, -1)} / 0.2)`,
        borderColor: fg,
        borderWidth: '1px',
      },
      icon: {
        opacity: 1,
        scale: 1,
        height: 8,
        width: 8,
        backgroundColor: fg,
        borderWidth: '0px',
      },
      area: {
        opacity: 1,
        scale: 1,
        height: 64,
        width: 64,
        backgroundColor: `${fg.slice(0, -1)} / 0.05)`,
        borderColor: `${fg.slice(0, -1)} / 0.2)`,
        borderWidth: '1px',
      },
    };
  };

  const cursorVariants = getCursorVariants(resolvedTheme);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  const springConfig = { damping: 40, stiffness: 350, mass: 0.7 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const resetIdleTimeout = () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      setIsIdle(false);
      idleTimeoutRef.current = setTimeout(() => setIsIdle(true), 2000);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPointerInViewport) {
        setIsPointerInViewport(true);
      }
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      resetIdleTimeout();

      const target = e.target as HTMLElement;
      const currentVariant = useCursorStore.getState().variant;
      
      const area = target.closest('[data-cursor-area]');
      if (area) {
        if (currentVariant !== 'area' && currentVariant !== 'pressed') setVariant('area');
        return;
      }
      
      const iconLink = target.closest('[data-cursor-icon]');
      if (iconLink) {
        if (currentVariant !== 'icon' && currentVariant !== 'pressed') setVariant('icon');
        return;
      }
      
      const clickableLink = target.closest('[data-cursor-link]');
      if (clickableLink) {
        if (currentVariant !== 'link' && currentVariant !== 'pressed') setVariant('link');
        return;
      }

      const textInput = target.closest('[data-cursor-text]');
      if (textInput) {
        if (currentVariant !== 'text' && currentVariant !== 'pressed') setVariant('text');
        return;
      }
  
      if (target.matches('a, button, [role="button"], [data-clickable]')) {
        if (currentVariant !== 'link' && currentVariant !== 'pressed') setVariant('link');
      } else {
        if (currentVariant !== 'default' && currentVariant !== 'pressed') setVariant('default');
      }
    };

    const handleMouseLeave = () => setIsPointerInViewport(false);
    
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

    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Set initial state
    resetIdleTimeout();

    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      unsubscribe();
    };
  }, [setVariant, isPointerInViewport]); 
  
  if (!mounted) {
    return null;
  }

  return (
    <div key={resolvedTheme} className="fixed inset-0 pointer-events-none z-50">
      <motion.div
        variants={cursorVariants}
        animate={isPointerInViewport && !isIdle ? variant : 'hidden'}
        style={{
          translateX: springX,
          translateY: springY,
        }}
        className="fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
      />
    </div>
  );
};

export default CustomCursor;