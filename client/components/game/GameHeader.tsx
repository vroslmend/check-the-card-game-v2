"use client"

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PanelLeftClose, PanelLeftOpen, Info, Copy, Check, ChevronLeft, User } from 'lucide-react';
import { useUIActorRef, useUISelector, type UIMachineSnapshot } from '@/context/GameUIContext';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Magnetic from '@/components/ui/Magnetic';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const selectGameHeaderProps = (state: UIMachineSnapshot) => {
  const localId = state.context.localPlayerId;
  const playerName = localId ? state.context.currentGameState?.players[localId]?.name ?? 'Player' : 'Player';
  return {
    gameId: state.context.gameId,
    isSidePanelOpen: state.context.isSidePanelOpen,
    playerName,
  };
};

export const GameHeader = () => {
  const { send } = useUIActorRef();
  const { gameId, isSidePanelOpen, playerName } = useUISelector(selectGameHeaderProps);
  const [copied, setCopied] = React.useState(false);

  const toggleSidePanel = () => {
    send({ type: 'TOGGLE_SIDE_PANEL' });
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200/30 dark:border-zinc-800/30 bg-white/30 dark:bg-zinc-900/30 backdrop-blur-md px-4 md:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <Magnetic>
          <Link href="/" data-cursor-link>
            <motion.div 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 group bg-stone-100/70 dark:bg-zinc-800/70 px-3 py-1.5 rounded-full"
            >
              <ChevronLeft className="h-4 w-4 text-stone-500 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-colors" />
              <span className="text-lg font-medium tracking-tight text-stone-900 dark:text-stone-100">Check</span>
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
              "flex items-center gap-2 bg-stone-100/70 hover:bg-stone-100/90 dark:bg-zinc-800/70 dark:hover:bg-zinc-800/90 px-3 py-1.5 rounded-full transition-colors", 
              "font-mono text-xs text-stone-700 dark:text-stone-300",
              copied && "opacity-80"
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

      <div className="flex items-center gap-2 h-10">
        <div className="hidden sm:flex items-center gap-1.5 bg-stone-100/70 dark:bg-zinc-800/70 rounded-full h-10 min-w-[40px] px-3">
          <User className="w-4 h-4 text-stone-500 dark:text-stone-400" />
          <span className="text-[15px] font-medium text-stone-700 dark:text-stone-300 leading-none" style={{lineHeight:'1'}}>{playerName}</span>
        </div>

        <div className="flex items-center h-10">
          <ThemeToggle />
        </div>

        <Magnetic>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 min-w-[40px] rounded-full bg-stone-100/70 hover:bg-stone-100/90 dark:bg-zinc-800/70 dark:hover:bg-zinc-800/90 flex items-center justify-center"
            data-cursor-link
          >
            <Info className="h-5 w-5 text-stone-600 dark:text-stone-400" />
            <span className="sr-only">Game Information</span>
          </Button>
        </Magnetic>

        <Magnetic>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidePanel} 
            className="h-10 w-10 min-w-[40px] rounded-full bg-stone-100/70 hover:bg-stone-100/90 dark:bg-zinc-800/70 dark:hover:bg-zinc-800/90 flex items-center justify-center"
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
                {isSidePanelOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
              </motion.div>
            </AnimatePresence>
            <span className="sr-only">Toggle side panel</span>
          </Button>
        </Magnetic>
      </div>
    </header>
  );
}; 