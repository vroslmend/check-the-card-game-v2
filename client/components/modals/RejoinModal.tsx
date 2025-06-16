// client/components/modals/RejoinModal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIActorRef, useUISelector, type UIMachineSnapshot } from '@/context/GameUIContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader, Users, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const selectRejoinModalProps = (state: UIMachineSnapshot) => {
  return {
    gameId: state.context.gameId,
    modalInfo: state.context.modal, 
    isLoading: state.hasTag('loading'), 
  }
}

export function RejoinModal() {
  const { send } = useUIActorRef();
  const { gameId, modalInfo, isLoading } = useUISelector(selectRejoinModalProps);
  
  // Use local state for the input field, initialized from localStorage
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('localPlayerName') || '';
    }
    return '';
  });

  // This effect ensures that if the modal becomes visible, the input is focused.
  useEffect(() => {
    if (modalInfo?.type === 'rejoin') {
      setTimeout(() => {
        document.getElementById('player-name-rejoin')?.focus();
      }, 100);
    }
  }, [modalInfo]);

  const isVisible = modalInfo?.type === 'rejoin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim().length < 2) {
      toast.error('Please enter a name with at least 2 characters.');
      return;
    }
    if (!gameId) {
      toast.error('Game ID is missing. Cannot join.');
      return;
    }
    
    // Persist the name for future joins
    localStorage.setItem('localPlayerName', playerName.trim());
    
    send({
      type: 'JOIN_GAME_REQUESTED',
      playerName: playerName.trim(),
      gameId,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && playerName.trim() && !isLoading) {
      handleSubmit(e);
    }
  };

  return (
    <Dialog open={isVisible} onOpenChange={(open) => !open && send({ type: 'DISMISS_MODAL' })}>
      <AnimatePresence>
        {isVisible && (
          <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white dark:bg-zinc-950 border-stone-200 dark:border-zinc-800 rounded-xl border">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <form onSubmit={handleSubmit} className="relative p-6 md:p-8">
                <DialogHeader className="mb-6 text-center">
                  <div className="inline-flex items-center justify-center gap-2 mx-auto">
                    <div className="rounded-full bg-stone-100 dark:bg-zinc-900 p-2">
                      <Users className="h-5 w-5 text-stone-600 dark:text-stone-400" />
                    </div>
                    <DialogTitle className="text-3xl font-light">{modalInfo?.title || 'Join Game'}</DialogTitle>
                  </div>
                  <DialogDescription className="text-stone-500 dark:text-stone-400 mt-2">
                    {modalInfo?.message || `You've been invited to game ${gameId}`}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mb-8">
                  <div className="space-y-2">
                    <Label htmlFor="player-name-rejoin" className="text-sm font-normal text-stone-600 dark:text-stone-400">
                      What should we call you?
                    </Label>
                    <Input
                      id="player-name-rejoin"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your name"
                      className="rounded-xl border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 h-12 px-4 text-lg text-center"
                      onKeyDown={onKeyDown}
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <Button
                    type="submit"
                    disabled={isLoading || !playerName.trim()}
                    className="w-full rounded-xl px-8 py-6 h-auto bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        Confirm and Join
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
}