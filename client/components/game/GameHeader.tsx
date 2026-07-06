"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelRightOpen, ChevronLeft, User } from 'lucide-react';
import { useUIActorRef, useUISelector, type UIMachineSnapshot } from '@/context/GameUIContext';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CopyToClipboardButton } from '../ui/CopyToClipboardButton';

const selectGameHeaderProps = (state: UIMachineSnapshot) => {
  const localId = state.context.localPlayerId;
  const playerName = localId ? state.context.currentGameState?.players[localId]?.name ?? 'Player' : 'Player';
  return {
    gameId: state.context.gameId,
    isSidePanelOpen: state.context.isSidePanelOpen,
    playerName,
    chatCount: state.context.currentGameState?.chat?.length ?? 0,
  };
};

export const GameHeader = () => {
  const { send } = useUIActorRef();
  const { gameId, isSidePanelOpen, playerName, chatCount } = useUISelector(selectGameHeaderProps);

  // Baseline on first sight: history isn't news (mount/rejoin shows no dot).
  const seenChatCountRef = React.useRef<number | null>(null);
  if (seenChatCountRef.current === null) seenChatCountRef.current = chatCount;
  React.useEffect(() => {
    if (isSidePanelOpen) seenChatCountRef.current = chatCount;
  }, [isSidePanelOpen, chatCount]);
  const hasUnread =
    !isSidePanelOpen && chatCount > (seenChatCountRef.current ?? 0);

  const toggleSidePanel = () => {
    send({ type: 'TOGGLE_SIDE_PANEL' });
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-hairline bg-ground px-4 md:px-6 relative top-0 z-20 font-game">
      <div className="flex items-center gap-4">
        <Link href="/" data-cursor-link>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 group border border-hairline bg-surface px-3 py-1.5 rounded-full"
          >
            <ChevronLeft className="h-4 w-4 text-ink-muted group-hover:text-ink transition-colors" />
            <span className="text-lg font-bold tracking-tight text-ink">Check</span>
          </motion.div>
        </Link>

        <div className="h-6 w-px bg-hairline" />
        
        <CopyToClipboardButton textToCopy={gameId} />
      </div>

      <div className="flex items-center gap-2 h-10">
        <div className="hidden sm:flex items-center gap-1.5 border border-hairline bg-surface rounded-full h-10 min-w-[40px] px-3">
          <User className="w-4 h-4 text-ink-muted" />
          <span className="text-[15px] font-semibold text-ink leading-none" style={{lineHeight:'1'}}>{playerName}</span>
        </div>

        <div className="flex items-center h-10">
          <ThemeToggle />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidePanel}
          className="relative h-10 w-10 min-w-[40px] rounded-full border border-hairline bg-surface hover:bg-surface-2 flex items-center justify-center"
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
              {isSidePanelOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
            </motion.div>
          </AnimatePresence>
          {hasUnread && (
            <span
              className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent"
              aria-hidden
            />
          )}
          <span className="sr-only">
            {hasUnread
              ? 'Toggle side panel (new messages)'
              : 'Toggle side panel'}
          </span>
        </Button>
      </div>
    </header>
  );
};