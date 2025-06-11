'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusCircle, Users, Shield, ArrowRight, Sparkles, SwitchCamera } from 'lucide-react';
import { useActorRef, useSelector } from '@xstate/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Magnetic from '@/components/ui/Magnetic';
import { uiMachine } from '@/machines/uiMachine';
import logger from '@/lib/logger';
import { socket } from '@/lib/socket';
import { SocketEventName } from 'shared-types';

// Variants for the container animations
const containerVariants = {
  initial: {
    opacity: 0,
    y: 20
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.6, 0.01, 0.05, 0.95]
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.6, 0.01, 0.05, 0.95]
    }
  }
};

// Variants for form field animations
const formVariants = {
  initial: {
    opacity: 0,
    x: -20
  },
  animate: (custom: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      delay: custom * 0.1,
      ease: [0.6, 0.01, 0.05, 0.95]
    }
  }),
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.3,
      ease: [0.6, 0.01, 0.05, 0.95]
    }
  }
};

export default function GameStartForm() {
  // Form state
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('localPlayerName') || '';
    }
    return '';
  });
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'join'>('create');
  const [step, setStep] = useState(1);
  const router = useRouter();
  
  // XState machine instance
  const actorRef = useActorRef(uiMachine, {
    input: {}
  });
  
  const isInGame = useSelector(actorRef, (state) => state.matches('inGame'));
  const joinedGameId = useSelector(actorRef, (state) => state.context.gameId);
  const machineState = useSelector(actorRef, (state) => state.value);

  useEffect(() => {
    setIsClient(true);
    
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
    
    logger.info('GameStartForm mounted');
  }, []);

  useEffect(() => {
    logger.info({ machineState, isInGame, joinedGameId }, 'Machine state updated');
    
    if (isInGame && joinedGameId) {
      logger.info({ joinedGameId }, 'Game operation successful, redirecting');
      toast.success(`${formMode === 'create' ? 'Created' : 'Joined'} game ${joinedGameId}`);
      router.push(`/game/${joinedGameId}`);
    }
  }, [isInGame, router, joinedGameId, machineState, formMode]);

  const toggleFormMode = () => {
    // Reset form when switching modes
    setStep(1);
    setFormMode(prev => prev === 'create' ? 'join' : 'create');
  };

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    
    logger.info({ playerName }, 'Creating game with player name');
    setIsLoading(true);
    localStorage.setItem('localPlayerName', playerName);
    
    try {
      // Direct socket connection for game creation instead of going through the machine
      socket.emit(SocketEventName.CREATE_GAME, { name: playerName }, (response) => {
        logger.info({ response }, 'Direct create game response received');
        
        if (response.success) {
          // Manually send the success event to the machine
          actorRef.send({ 
            type: 'GAME_CREATED_SUCCESSFULLY', 
            response 
          });
        } else {
          logger.error({ error: response.message }, 'Failed to create game');
          toast.error('Failed to create game', { description: response.message });
          setIsLoading(false);
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error creating game');
      toast.error('An error occurred while creating the game');
      setIsLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!gameId.trim() || !playerName.trim()) {
      toast.error('Please enter a game ID and your name.');
      return;
    }
    
    logger.info({ playerName, gameId }, 'Joining game');
    setIsLoading(true);
    localStorage.setItem('localPlayerName', playerName);
    
    try {
      // Direct socket connection for joining a game
      socket.emit(SocketEventName.JOIN_GAME, gameId, { name: playerName }, (response) => {
        logger.info({ response }, 'Direct join game response received');
        
        if (response.success) {
          // Manually send the success event to the machine
          actorRef.send({ 
            type: 'GAME_JOINED_SUCCESSFULLY', 
            response 
          });
        } else {
          logger.error({ error: response.message }, 'Failed to join game');
          toast.error('Failed to join game', { description: response.message });
          setIsLoading(false);
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error joining game');
      toast.error('An error occurred while joining the game');
      setIsLoading(false);
    }
  };

  const handleNextStep = () => {
    if (step === 1 && !playerName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    
    if (formMode === 'join' && step === 2 && !gameId.trim()) {
      toast.error('Please enter a game ID.');
      return;
    }
    
    if (formMode === 'create' || step === 1) {
      if (formMode === 'create') {
        handleCreateGame();
      } else {
        setStep(2);
      }
    } else {
      handleJoinGame();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNextStep();
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <motion.div 
      initial="initial"
      animate="animate"
      exit="exit"
      variants={containerVariants}
      className="w-full max-w-md bg-white/80 dark:bg-zinc-950/80 rounded-[2.5rem] shadow-2xl p-8 relative overflow-hidden backdrop-blur-xl border border-stone-200 dark:border-zinc-800"
    >
      {/* Decorative background elements */}
      <motion.div 
        className="absolute -top-10 -right-10 w-64 h-64 bg-gradient-to-br from-stone-100 dark:from-zinc-900 rounded-full blur-3xl"
        animate={{ 
          x: [0, 20, 0],
          y: [0, -20, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute -bottom-10 -left-10 w-72 h-72 bg-gradient-to-t from-stone-100 dark:from-zinc-900 rounded-full blur-3xl"
        animate={{ 
          x: [0, -30, 0],
          y: [0, 20, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <div className="relative">
        {/* Form header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-stone-100 dark:bg-zinc-800 p-1.5">
                {formMode === 'create' ? (
                  <PlusCircle className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                ) : (
                  <Users className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                )}
              </div>
              <h1 className="text-2xl font-light text-stone-900 dark:text-stone-100">
                {formMode === 'create' ? 'Create a New Game' : 'Join a Game'}
              </h1>
            </div>
            <Magnetic>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFormMode}
                className="rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800"
                data-cursor-link
              >
                <SwitchCamera className="h-4 w-4 text-stone-500 dark:text-stone-400" />
              </Button>
            </Magnetic>
          </div>
          <p className="text-stone-500 dark:text-stone-400">
            {formMode === 'create'
              ? 'Start a new game session and invite friends to join.'
              : 'Connect with friends and join an existing game session.'}
          </p>
        </div>
        
        {/* Form content area */}
        <div className="mb-8 space-y-6">
          <AnimatePresence mode="wait">
            {formMode === 'create' || (formMode === 'join' && step === 1) ? (
              <motion.div 
                key="name-step"
                custom={0}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={formVariants}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-normal text-stone-600 dark:text-stone-400">
                    What should we call you?
                  </Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="rounded-xl border-stone-200 bg-white/60 dark:bg-zinc-900/60 dark:border-zinc-800 h-12 px-4 backdrop-blur-md"
                    onKeyDown={onKeyDown}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                
                {formMode === 'create' && (
                  <motion.div
                    key="game-master-info"
                    custom={1}
                    variants={formVariants}
                    className="bg-white/60 dark:bg-zinc-900/60 rounded-xl p-4 border border-stone-200/80 dark:border-zinc-800/80 backdrop-blur-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-2 mt-0.5">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-stone-800 dark:text-stone-200 mb-1">Game Master</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          As the creator, you'll be the Game Master with special privileges to manage the game session.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="game-step"
                custom={0}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={formVariants}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="game-id" className="text-sm font-normal text-stone-600 dark:text-stone-400">
                    Enter the game ID provided by your friend
                  </Label>
                  <Input
                    id="game-id"
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                    placeholder="Game ID"
                    className="rounded-xl border-stone-200 bg-white/60 dark:bg-zinc-900/60 dark:border-zinc-800 h-12 px-4 font-mono backdrop-blur-md"
                    onKeyDown={onKeyDown}
                    autoComplete="off"
                    autoFocus
                  />
                  <p className="text-xs text-stone-500 dark:text-stone-500 mt-2">
                    <Shield className="h-3 w-3 inline mr-1" />
                    Make sure you have the correct code from the game creator
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Form footer actions */}
        <div className="flex justify-between">
          {formMode === 'join' && step === 2 && (
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
            >
              Back
            </Button>
          )}
          <div className={formMode === 'join' && step === 2 ? 'ml-auto' : 'w-full'}>
            <Magnetic>
              <Button 
                onClick={handleNextStep} 
                disabled={isLoading}
                className="rounded-full shadow-xl px-8 py-6 h-auto bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 relative overflow-hidden group w-full"
                data-cursor-link
              >
                <span className="relative z-10 flex items-center gap-2 justify-center">
                  {isLoading ? (formMode === 'create' ? 'Creating...' : 'Joining...') : 
                   (formMode === 'create' ? 'Create Game' : (step === 1 ? 'Next' : 'Join Game'))}
                  <motion.div
                    animate={{ x: [0, 4, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <ArrowRight className="h-4 w-4 pointer-events-none" />
                  </motion.div>
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
        </div>
      </div>
    </motion.div>
  );
} 