"use client"

import { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Users, Shield, ArrowRight } from 'lucide-react';
import { useSelector } from '@xstate/react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Magnetic from '@/components/ui/Magnetic';
import { UIContext } from '../providers/UIMachineProvider';

interface JoinGameModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
}

export function JoinGameModal({ isModalOpen, setIsModalOpen }: JoinGameModalProps) {
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('localPlayerName') || '';
    }
    return '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const router = useRouter();
  const uiContext = useContext(UIContext);

  const actorRef = uiContext?.actorRef;
  const isInGame = useSelector(actorRef!, (state) => state.matches('inGame'));

  useEffect(() => {
    if (actorRef && isInGame) {
      const { gameId: joinedGameId } = actorRef.getSnapshot().context;
      if (joinedGameId) {
        toast.success(`Joined game ${joinedGameId}`);
        router.push(`/game/${joinedGameId}`);
        setIsLoading(false);
      }
    }
  }, [isInGame, router, actorRef]);

  const handleJoinGame = async () => {
    if (!gameId.trim() || !playerName.trim()) {
      toast.error('Please enter a game ID and your name.');
      return;
    }
    if (!actorRef) {
      toast.error('UI service not available. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    localStorage.setItem('localPlayerName', playerName);
    actorRef.send({ type: 'JOIN_GAME_REQUESTED', gameId, playerName });
  };

  const handleNextStep = () => {
    if (step === 1 && !playerName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    
    if (step === 2 && !gameId.trim()) {
      toast.error('Please enter a game ID.');
      return;
    }
    
    if (step === 1) {
      setStep(2);
    } else {
      handleJoinGame();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNextStep();
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setIsModalOpen(false);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800">
        <div className="relative">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-stone-100 dark:bg-zinc-900 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-stone-100 dark:bg-zinc-900 rounded-full blur-3xl opacity-60" />
          
          <div className="relative p-6">
            <DialogHeader className="mb-6">
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-2 flex items-center gap-2"
              >
                <div className="rounded-full bg-stone-100 dark:bg-zinc-900 p-1.5">
                  <Users className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                </div>
                <DialogTitle className="text-2xl font-light">Join a Game</DialogTitle>
              </motion.div>
              <DialogDescription className="text-stone-500 dark:text-stone-400">
                Connect with friends and join an existing game session.
              </DialogDescription>
            </DialogHeader>
            
            <div className="mb-6">
              <div className="flex justify-between mb-4">
                <div className={`flex items-center gap-2 ${step >= 1 ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}>
                  <div className={`rounded-full h-6 w-6 flex items-center justify-center ${step >= 1 ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-500'}`}>
                    {step > 1 ? <CheckCircle className="h-4 w-4" /> : "1"}
                  </div>
                  <span className="text-sm">Your Identity</span>
                </div>
                <div className="flex-1 border-t border-dashed border-stone-200 dark:border-zinc-800 self-center mx-2"></div>
                <div className={`flex items-center gap-2 ${step >= 2 ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}>
                  <div className={`rounded-full h-6 w-6 flex items-center justify-center ${step >= 2 ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-500'}`}>
                    2
                  </div>
                  <span className="text-sm">Game Code</span>
                </div>
              </div>
              
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div 
                    key="name-step"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="player-name" className="text-sm font-normal text-stone-600 dark:text-stone-400">
                        What should we call you?
                      </Label>
                      <Input
                        id="player-name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your name"
                        className="rounded-xl border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 h-12 px-4"
                        onKeyDown={onKeyDown}
                        autoComplete="off"
                      />
                    </div>
                  </motion.div>
                )}
                
                {step === 2 && (
                  <motion.div 
                    key="game-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
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
                        className="rounded-xl border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 h-12 px-4 font-mono"
                        onKeyDown={onKeyDown}
                        autoComplete="off"
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
            
            <DialogFooter className="flex items-center justify-between mt-8">
              {step > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep(1)}
                  className="rounded-xl border-stone-200 dark:border-zinc-800"
                  data-cursor-link
                >
                  Back
                </Button>
              )}
              <div className={step === 1 ? 'ml-auto' : ''}>
                <Magnetic>
                  <Button 
                    type="button" 
                    onClick={handleNextStep} 
                    disabled={isLoading}
                    className="rounded-xl px-8 py-6 h-auto bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 relative overflow-hidden group"
                    data-cursor-link
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {isLoading ? 'Loading...' : step === 1 ? 'Continue' : 'Join Game'}
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
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}