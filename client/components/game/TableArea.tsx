'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '@/components/providers/UIMachineProvider';
import { DeckCard } from '@/components/cards/DeckCard';
import { TurnPhase, CardRank, PlayerActionType } from 'shared-types';
import { Layers, ArrowDown, Clock } from 'lucide-react';

export const TableArea = () => {
  const [state, send] = useUI();

  const { currentGameState, localPlayerId } = state.context;
  const { deckSize = 0, discardPile = [], turnPhase, currentPlayerId, players } = currentGameState ?? {};

  const topDiscardCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isMyTurn = currentPlayerId === localPlayerId;

  const canDrawFromDeck = isMyTurn && turnPhase === TurnPhase.DRAW;
  
  // Check if the discard pile is drawable - face cards cannot be picked up
  const isDiscardDrawable = Boolean(
    topDiscardCard && !new Set([CardRank.King, CardRank.Queen, CardRank.Jack]).has(topDiscardCard.rank)
  );
  const canDrawFromDiscard = isMyTurn && turnPhase === TurnPhase.DRAW && isDiscardDrawable;

  const handleDeckClick = () => {
    if (canDrawFromDeck) {
      send({ type: 'DRAW_CARD' });
    }
  };

  const handleDiscardClick = () => {
    if (canDrawFromDiscard && localPlayerId) {
      send({ type: 'PLAYER_ACTION', payload: { type: PlayerActionType.DRAW_FROM_DISCARD, payload: { playerId: localPlayerId } } });
    }
  };

  const currentPlayerName = players && currentPlayerId ? players[currentPlayerId]?.name : '...';
  const isLocalPlayerTurn = currentPlayerId === localPlayerId;

  const getPhaseText = () => {
    if (!turnPhase || !players) return 'Waiting...';
    switch (turnPhase) {
      case TurnPhase.DRAW: return 'Draw Phase';
      case TurnPhase.ACTION: return 'Action Phase';
      case TurnPhase.DISCARD: return 'Discard Phase';
      default: return 'Loading...';
    }
  }

  const getPhaseIcon = () => {
    if (!turnPhase) return <Clock className="h-4 w-4" />;
    switch (turnPhase) {
      case TurnPhase.DRAW: return <Layers className="h-4 w-4" />;
      case TurnPhase.ACTION: return <ArrowDown className="h-4 w-4 rotate-45" />;
      case TurnPhase.DISCARD: return <ArrowDown className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  }

  return (
    <div className="relative h-full">
      {/* Background */}
      <motion.div 
        className="absolute inset-0 rounded-3xl bg-gradient-to-b from-stone-100/80 to-white/50 dark:from-zinc-900/80 dark:to-zinc-950/50 backdrop-blur-sm border border-stone-200/60 dark:border-zinc-800/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Main content */}
      <div className="relative flex h-full items-center justify-center gap-20 p-4">
        {/* Deck */}
        <motion.div
          whileHover={canDrawFromDeck ? { scale: 1.03 } : {}}
          className="relative"
        >
          <DeckCard 
            count={deckSize} 
            isInteractive={canDrawFromDeck}
            onClick={handleDeckClick}
            label="Draw Pile"
          />
          {canDrawFromDeck && (
            <motion.div
              className="absolute -top-4 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-3 py-1 rounded-full text-xs font-medium"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
            >
              Draw
            </motion.div>
          )}
        </motion.div>

        {/* Discard Pile */}
        <motion.div
          whileHover={canDrawFromDiscard ? { scale: 1.03 } : {}}
          className="relative"
        >
          <DeckCard 
            card={topDiscardCard} 
            count={discardPile.length}
            isInteractive={canDrawFromDiscard}
            onClick={handleDiscardClick}
            label="Discard Pile"
          />
          <AnimatePresence>
            {canDrawFromDiscard && (
              <motion.div
                className="absolute -top-4 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-3 py-1 rounded-full text-xs font-medium"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
              >
                Pick Up
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Game Phase / Status Indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentPlayerId}-${turnPhase}`}
            layoutId="activePlayerIndicator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2"
          >
            <motion.div 
              className="rounded-xl overflow-hidden border border-stone-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm px-6 py-3 text-center shadow-xl"
              animate={{ 
                boxShadow: isLocalPlayerTurn 
                  ? ['0 5px 15px rgba(0,0,0,0.1)', '0 8px 25px rgba(0,0,0,0.15)', '0 5px 15px rgba(0,0,0,0.1)'] 
                  : '0 5px 15px rgba(0,0,0,0.1)'
              }}
              transition={{ 
                duration: 2, 
                repeat: isLocalPlayerTurn ? Infinity : 0,
                repeatType: 'reverse'
              }}
            >
              <p className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-stone-600 dark:text-stone-400">It's</span>
                <span className={`font-medium ${isLocalPlayerTurn ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-900 dark:text-stone-100'}`}>
                  {isLocalPlayerTurn ? 'Your' : currentPlayerName + "'s"}
                </span>
                <span className="text-stone-600 dark:text-stone-400">turn</span>
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-stone-500 dark:text-stone-500 font-light">
                <span className="flex items-center gap-1.5">
                  {getPhaseIcon()}
                  <span>{getPhaseText()}</span>
                </span>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};