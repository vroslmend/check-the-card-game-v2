import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ClientCard } from 'shared-types';
import CardComponent from './CardComponent';
import { FiAward, FiRotateCcw, FiX } from 'react-icons/fi';

interface Score {
  name: string;
  score: number;
}

interface FinalHand {
  playerName: string;
  cards: ClientCard[];
}

interface PlayerStat {
  name: string;
  numMatches: number;
  numPenalties: number;
}

interface EndOfGameModalProps {
  open: boolean;
  onClose: () => void;
  winner: string | string[];
  scores: Score[];
  finalHands: FinalHand[];
  onPlayAgain: () => void;
  totalTurns?: number;
  playerStats?: PlayerStat[];
}

const EndOfGameModal: React.FC<EndOfGameModalProps> = ({
  open,
  onClose,
  winner,
  scores,
  finalHands,
  onPlayAgain,
  totalTurns,
  playerStats,
}) => {
  if (!open) {
    return null;
  }

  const winnerText = Array.isArray(winner) ? winner.join(' & ') : winner;

  const listItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.07,
        type: 'spring',
        stiffness: 260,
        damping: 20,
      },
    }),
  };

  const cardSpawnVariants = {
    hidden: { opacity: 0, scale: 0.5, rotate: -15, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      scale: 1,
      rotate: 0,
      y: 0,
      transition: {
        delay: i * 0.12,
        type: 'spring',
        stiffness: 200,
        damping: 15,
      },
    }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        key="end-game-modal"
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-neutral-300 dark:border-neutral-700"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-sky-600 dark:text-sky-400">
            Game Over!
          </h2>
          <motion.button
            onClick={onClose}
            className="p-1.5 text-neutral-500 dark:text-neutral-300 hover:text-neutral-700 dark:hover:text-neutral-100 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Close modal"
          >
            <FiX size={20} />
          </motion.button>
        </div>

        <div className="p-4 sm:p-6 flex-grow overflow-y-auto styled-scrollbar-dark space-y-5 sm:space-y-6 text-neutral-700 dark:text-neutral-200">
          <motion.div 
            className="text-center py-3 sm:py-4 bg-gradient-to-br from-sky-500 to-sky-600 dark:from-sky-600 dark:to-sky-700 rounded-lg shadow-lg"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 150, damping: 20 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 180, damping: 12 }}
            >
              <FiAward className="mx-auto text-yellow-300 dark:text-yellow-400 text-5xl sm:text-6xl mb-1 sm:mb-2" />
            </motion.div>
            <motion.h3 
              className="text-2xl sm:text-3xl font-bold text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {winnerText || 'N/A'}
            </motion.h3>
            <motion.p 
              className="text-sm sm:text-base text-sky-100 dark:text-sky-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {Array.isArray(winner) ? 'are the Winners!' : 'is the Winner!'}
            </motion.p>
          </motion.div>

          {scores && scores.length > 0 && (
            <section>
              <h4 className="text-lg sm:text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2 sm:mb-3">Scores</h4>
              <ul className="space-y-1.5 sm:space-y-2">
                {scores.sort((a, b) => b.score - a.score).map((player, i) => (
                  <motion.li
                    key={player.name}
                    custom={i}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex justify-between items-center p-2 sm:p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-md shadow-sm"
                  >
                    <span className="text-sm sm:text-base text-neutral-700 dark:text-neutral-200">{player.name}</span>
                    <span className="text-sm sm:text-base font-semibold text-sky-600 dark:text-sky-400">{player.score} pts</span>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}
          
          {finalHands && finalHands.length > 0 && (
            <section>
              <h4 className="text-lg sm:text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2 sm:mb-3">Final Hands</h4>
              <div className="space-y-3 sm:space-y-4">
                {finalHands.map((playerHand, i) => (
                  <motion.div 
                    key={playerHand.playerName}
                    custom={i}
                    variants={listItemVariants} 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                  >
                    <h5 className="text-sm sm:text-base font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 sm:mb-2">{playerHand.playerName}</h5>
                    <div className="flex flex-row flex-wrap gap-1.5 sm:gap-2 p-2 sm:p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-md shadow-sm justify-center">
                      {playerHand.cards.length > 0 ? playerHand.cards.map((card, cardIdx) => (
                        <motion.div
                          key={card.id || ('rank' in card && 'suit' in card ? `${card.rank}-${card.suit}-${cardIdx}` : `hidden-card-${cardIdx}`)}
                          custom={cardIdx}
                          variants={cardSpawnVariants}
                          initial="hidden"
                          whileInView="visible"
                          viewport={{ once: true, amount: 0.1 }}
                          className="w-12 md:w-16 aspect-[2.5/3.5]"
                        >
                          <CardComponent
                            card={card}
                            isFaceUp={true}
                            forceShowFront={true}
                            isInteractive={false}
                            disableHoverEffect={true}
                          />
                        </motion.div>
                      )) : (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">No cards</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {playerStats && playerStats.length > 0 && (
             <section>
              <h4 className="text-lg sm:text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2 sm:mb-3">Player Stats</h4>
              <ul className="space-y-1.5 sm:space-y-2">
                {playerStats.map((stat, i) => (
                  <motion.li
                    key={stat.name}
                    custom={i}
                    variants={listItemVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    className="grid grid-cols-3 gap-2 items-center p-2 sm:p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-md shadow-sm text-xs sm:text-sm"
                  >
                    <span className="text-neutral-700 dark:text-neutral-200 truncate col-span-1">{stat.name}</span>
                    <span className="text-neutral-600 dark:text-neutral-300 text-center">Matches: {stat.numMatches}</span>
                    <span className="text-neutral-600 dark:text-neutral-300 text-center">Penalties: {stat.numPenalties}</span>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}

          {totalTurns !== undefined && (
            <motion.div 
              className="text-center"
              initial="hidden" 
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              custom={ (scores?.length || 0) + (finalHands?.length || 0) + (playerStats?.length || 0) }
              variants={listItemVariants}
            >
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
                Game completed in <span className="font-semibold text-neutral-700 dark:text-neutral-100">{totalTurns}</span> turns.
              </p>
            </motion.div>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <motion.button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-md text-sm sm:text-base font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-black transition-all duration-150 ease-in-out"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <FiRotateCcw size={18} className="mr-2" />
            Play Again
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default EndOfGameModal; 