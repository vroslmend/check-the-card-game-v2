"use client"

import React, { useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeftOpen, Info, Copy, Check, ChevronLeft } from 'lucide-react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Magnetic from '@/components/ui/Magnetic';

const selectGameHeaderProps = (state: UIMachineSnapshot) => {
  return {
    gameId: state.context.gameId,
    isSidePanelOpen: state.context.isSidePanelOpen,
  };
};

export const GameHeader = () => {
  const { actorRef } = useContext(UIContext)!;
  const { gameId, isSidePanelOpen } = useSelector(actorRef, selectGameHeaderProps);
  const [copied, setCopied] = React.useState(false);

  const toggleSidePanel = () => {
    actorRef.send({ type: 'TOGGLE_SIDE_PANEL' });
  };

  const handleCopyGameId = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId);
      setCopied(true);
      toast.success("Copied to clipboard", {
        description: "Game ID has been copied to your clipboard.",
        duration: 2000,
      });
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <Magnetic>
          <Link href="/" data-cursor-link>
            <motion.div 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 group"
            >
              <ChevronLeft className="h-4 w-4 text-stone-500 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors" />
              <span className="text-xl font-light tracking-tight text-stone-900 dark:text-stone-100">Check</span>
            </motion.div>
          </Link>
        </Magnetic>

        <div className="h-6 w-px bg-stone-200 dark:bg-zinc-800" />
        
        <motion.div
          className="flex items-center gap-2"
          layout
        >
          <button
            onClick={handleCopyGameId}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-300",
              "bg-stone-100 dark:bg-zinc-900 hover:bg-stone-200 dark:hover:bg-zinc-800",
              "text-stone-600 dark:text-stone-400"
            )}
            data-cursor-link
          >
            <span>{gameId ?? '...'}</span>
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        <Magnetic>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-full bg-stone-100 dark:bg-zinc-900 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            data-cursor-link
          >
            <Info className="h-4 w-4" />
            <span className="sr-only">Game Information</span>
          </Button>
        </Magnetic>

        <Magnetic>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidePanel} 
            className="h-9 w-9 rounded-full bg-stone-100 dark:bg-zinc-900 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            data-cursor-link
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={isSidePanelOpen ? 'open' : 'closed'}
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
              >
                {isSidePanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </motion.div>
            </AnimatePresence>
            <span className="sr-only">Toggle side panel</span>
          </Button>
        </Magnetic>
      </div>
    </header>
  );
}; 