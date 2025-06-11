'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import GameStartForm from '@/components/game/GameStartForm';
import Magnetic from '@/components/ui/Magnetic';
import { Button } from '@/components/ui/button';

const pageVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.7,
      ease: [0.6, 0.01, 0.05, 0.95],
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.4,
    },
  },
};

export default function StartGamePage() {
  const [formMode, setFormMode] = useState<'create' | 'join'>('create');
  const router = useRouter();

  // Scroll to top on page load for best animation experience
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Check URL for mode parameter
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      if (modeParam === 'join') {
        setFormMode('join');
      } else if (modeParam === 'create') {
        setFormMode('create');
      }
    }
  }, []);

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 relative overflow-hidden">
      {/* Decorative background elements */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-stone-100/70 dark:from-zinc-900/40 rounded-full blur-3xl"
          animate={{
            x: [0, 20, -20, 0],
            y: [0, -30, 20, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-gradient-to-t from-stone-100/70 dark:from-zinc-900/40 rounded-full blur-3xl"
          animate={{
            x: [0, -40, 40, 0],
            y: [0, 30, -30, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        className="flex flex-col items-center justify-center min-h-screen p-4 relative z-10"
      >
        {/* Back button */}
        <motion.div 
          className="absolute top-8 left-8 z-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Magnetic>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-900 shadow-md"
              data-cursor-link
            >
              <ArrowLeft className="h-4 w-4 text-stone-900 dark:text-stone-100" />
            </Button>
          </Magnetic>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-10 text-center"
        >
          <h1 className="text-5xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
            {formMode === 'create' ? 'Create Game' : 'Join Game'}
          </h1>
          <p className="text-stone-500 dark:text-stone-400 mt-2 text-lg">
            {formMode === 'create' ? 'Start a new adventure' : 'Connect with friends'}
          </p>
        </motion.div>

        <motion.div
          variants={{
            initial: { opacity: 0, scale: 0.9 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.9 }
          }}
          transition={{ duration: 0.5, ease: [0.6, 0.01, 0.05, 0.95] }}
        >
          <GameStartForm />
        </motion.div>
      </motion.div>
    </div>
  );
} 