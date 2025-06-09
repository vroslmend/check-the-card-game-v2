'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useUI } from '@/components/providers/uiMachineProvider';
import { Button } from '@/components/ui/button';
import PlayerHand from '@/components/game/PlayerHand';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export const InitialPeek = () => {
  const [state, send] = useUI();
  const [canAcknowledge, setCanAcknowledge] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const { localPlayerId, currentGameState } = state.context;
  const players = currentGameState?.players ?? {};
  const localPlayer = localPlayerId ? players[localPlayerId] : null;

  const deadline = useMemo(() => {
    return localPlayer?.peekAcknowledgeDeadline ?? 0;
  }, [localPlayer?.peekAcknowledgeDeadline]);

  useEffect(() => {
    if (!deadline) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [deadline]);

  useEffect(() => {
    // Prevent accidentally clicking through without seeing cards.
    const enableTimeout = setTimeout(() => {
      setCanAcknowledge(true);
    }, 2000); // User must wait 2 seconds

    return () => clearTimeout(enableTimeout);
  }, []);

  const handleAcknowledge = () => {
    send({ type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' });
  };

  if (!localPlayer || !localPlayerId) {
    return <div>Loading player...</div>;
  }
  
  const hasAcknowledged = localPlayer.hasAcknowledgedPeek;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex items-center justify-center"
    >
      <Card className="max-w-2xl w-full shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-light">Initial Peek</CardTitle>
          <CardDescription>
            {hasAcknowledged 
              ? "Waiting for other players to view their cards..."
              : "Take a look at your starting cards. Remember them!" 
            }
          </CardDescription>
          {!hasAcknowledged && timeRemaining > 0 && (
            <div className="flex items-center justify-center gap-2 text-amber-500 font-semibold pt-2">
              <Clock className="h-5 w-5" />
              <span>{timeRemaining}s to decide</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-8 p-8">
          <PlayerHand
            hand={localPlayer.hand}
            localPlayerId={localPlayerId}
            onCardClick={() => {}} // Dummy handler, cards are not interactive in this phase
          />
          
          {!hasAcknowledged && (
            <Button 
              size="lg" 
              className="w-full max-w-xs h-12 text-lg font-light mt-4" 
              onClick={handleAcknowledge}
              disabled={!canAcknowledge || timeRemaining === 0}
            >
              {timeRemaining > 0 ? "I'm Ready to Play" : "Time's Up!"}
            </Button>
          )}

          {hasAcknowledged && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center p-4 bg-muted/30 rounded-xl mt-4"
            >
              <p className="text-sm text-muted-foreground">Waiting for others...</p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default InitialPeek; 