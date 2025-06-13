'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useUIActorRef } from '@/context/GameUIContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Shield, Users } from 'lucide-react';
import Magnetic from '@/components/ui/Magnetic';

export const JoinGamePrompt = () => {
  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('localPlayerName') || '';
    }
    return '';
  });

  const [isLoading, setIsLoading] = useState(false);
  const { send } = useUIActorRef();
  const params = useParams();
  const gameId = params.gameId as string;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim().length < 2) {
      toast.error('Please enter a name with at least 2 characters.');
      return;
    }
    
    setIsLoading(true);
    // Persist the name for future joins
    localStorage.setItem('localPlayerName', playerName.trim());
    
    send({
      type: 'JOIN_GAME_REQUESTED',
      playerName: playerName.trim(),
      gameId,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-stone-50 dark:bg-zinc-950">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md mx-auto"
      >
        <div className="relative overflow-hidden bg-white dark:bg-zinc-950 rounded-[2.5rem] border border-stone-200 dark:border-zinc-800 backdrop-blur-xl shadow-2xl">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-stone-100 dark:bg-zinc-900 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-stone-100 dark:bg-zinc-900 rounded-full blur-3xl opacity-60" />

          <form onSubmit={handleSubmit} className="relative p-8 md:p-10">
            <div className="mb-8 text-center">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="inline-flex items-center gap-2"
              >
                <div className="rounded-full bg-stone-100 dark:bg-zinc-900 p-2">
                  <Users className="h-5 w-5 text-stone-600 dark:text-stone-400" />
                </div>
                <h1 className="text-4xl font-light tracking-tight text-stone-900 dark:text-stone-100">Join Game</h1>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-stone-500 dark:text-stone-400 mt-2 font-light text-base"
              >
                You've been invited to game <code className="font-mono bg-stone-100 dark:bg-zinc-800 p-1 rounded-md">{gameId}</code>
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="space-y-4 mb-10"
            >
              <div className="space-y-2 text-center">
                <label htmlFor="player-name" className="text-sm font-normal text-stone-600 dark:text-stone-400">
                  What should we call you?
                </label>
                <Input
                  id="player-name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="rounded-xl border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 h-12 px-4 text-lg text-center"
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                  autoFocus
                  data-cursor-text
                />
              </div>
            </motion.div>

            <div className="flex items-center justify-center">
              <Magnetic>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-xl px-8 py-6 h-auto bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 relative overflow-hidden group w-full"
                  data-cursor-link
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 w-full">
                    {isLoading ? 'Joining...' : 'Confirm and Join'}
                    {!isLoading && (
                      <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </motion.div>
                    )}
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-stone-800 to-stone-700 dark:from-stone-200 dark:to-stone-300"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "0%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </Button>
              </Magnetic>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}; 