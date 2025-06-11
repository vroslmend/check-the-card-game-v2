'use client';

import React, { useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { DeckCard } from '@/components/cards/DeckCard';
import { TurnPhase, CardRank, GameStage } from 'shared-types';
import { Layers, ArrowDown, Clock, Users, Eye, Trophy } from 'lucide-react';

const selectTableAreaProps = (state: UIMachineSnapshot) => {
  const { currentGameState, localPlayerId } = state.context;
  const {
    deckSize = 0,
    discardPile = [],
    turnPhase,
    currentPlayerId,
    players,
    gameStage,
    discardPileIsSealed,
  } = currentGameState ?? {};

  const topDiscardCard =
    discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const isMyTurn = currentPlayerId === localPlayerId;

  const canDrawFromDeck = isMyTurn && turnPhase === TurnPhase.DRAW;

  const isDiscardCardDrawable = Boolean(
    topDiscardCard &&
      !new Set([CardRank.King, CardRank.Queen, CardRank.Jack]).has(
        topDiscardCard.rank
      )
  );
  
  const canDrawFromDiscard =
    isMyTurn && turnPhase === TurnPhase.DRAW && isDiscardCardDrawable && !discardPileIsSealed;

  const currentPlayerName =
    players && currentPlayerId ? players[currentPlayerId]?.name : '...';

  return {
    deckSize,
    discardPile,
    topDiscardCard,
    turnPhase,
    gameStage,
    canDrawFromDeck,
    canDrawFromDiscard,
    currentPlayerName,
    isLocalPlayerTurn: isMyTurn,
    players,
    currentPlayerId,
  };
};

export const TableArea = () => {
  const { actorRef } = useContext(UIContext)!;
  const {
    deckSize,
    discardPile,
    topDiscardCard,
    turnPhase,
    gameStage,
    canDrawFromDeck,
    canDrawFromDiscard,
    currentPlayerName,
    isLocalPlayerTurn,
    players,
    currentPlayerId,
  } = useSelector(actorRef, selectTableAreaProps);

  const handleDeckClick = () => {
    if (canDrawFromDeck) {
      actorRef.send({ type: 'DRAW_FROM_DECK' });
    }
  };

  const handleDiscardClick = () => {
    if (canDrawFromDiscard) {
      actorRef.send({ type: 'DRAW_FROM_DISCARD' });
    }
  };

  const getGameStageIcon = () => {
    switch (gameStage) {
      case GameStage.WAITING_FOR_PLAYERS: return <Users className="h-5 w-5" />;
      case GameStage.INITIAL_PEEK: return <Eye className="h-5 w-5" />;
      case GameStage.PLAYING: return <Layers className="h-5 w-5" />;
      case GameStage.CHECK: return <Clock className="h-5 w-5" />;
      case GameStage.GAMEOVER: return <Trophy className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  const getGameStageName = () => {
    switch (gameStage) {
      case GameStage.WAITING_FOR_PLAYERS: return "Waiting for Players";
      case GameStage.INITIAL_PEEK: return "Initial Peek";
      case GameStage.PLAYING: return "Game in Progress";
      case GameStage.CHECK: return "Check Called!";
      case GameStage.GAMEOVER: return "Game Over";
      default: return "Loading...";
    }
  };

  const getPhaseText = () => {
    if (!turnPhase || !players) return 'Waiting...';
    switch (turnPhase) {
      case TurnPhase.DRAW: return 'Draw Phase';
      case TurnPhase.ACTION: return 'Action Phase';
      case TurnPhase.DISCARD: return 'Discard Phase';
      default: 'Loading...';
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
    <div className="relative h-full w-full flex flex-col">
      {/* Game Stage Indicator */}
      <motion.div 
        className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-black/30 backdrop-blur-sm shadow-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center
          ${gameStage === GameStage.PLAYING ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
            gameStage === GameStage.CHECK ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
            gameStage === GameStage.GAMEOVER ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
            'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}
        `}>
          {getGameStageIcon()}
        </div>
        <span className="font-medium text-stone-800 dark:text-stone-200">{getGameStageName()}</span>
      </motion.div>

      {/* Background */}
      <motion.div 
        className="absolute inset-0 rounded-3xl bg-gradient-to-b from-stone-100/80 to-white/50 dark:from-zinc-900/80 dark:to-zinc-950/50 backdrop-blur-sm border border-stone-200/60 dark:border-zinc-800/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center space-x-32 md:space-x-40 lg:space-x-48">
          {/* Deck */}
          <div className="flex flex-col items-center">
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
              <AnimatePresence>
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
              </AnimatePresence>
            </motion.div>
            <span className="mt-2 text-sm text-stone-600 dark:text-stone-400">Draw Pile</span>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center">
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
            <span className="mt-2 text-sm text-stone-600 dark:text-stone-400">Discard Pile</span>
          </div>
        </div>

        {/* Game Phase / Status Indicator */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentPlayerId}-${turnPhase}`}
            layoutId="activePlayerIndicator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-0"
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