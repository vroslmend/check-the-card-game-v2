import React from 'react';
import type { Card, ClientCard } from 'shared-types';
import CardComponent from './CardComponent';
import { motion } from 'motion/react';

interface ScoreEntry {
  name: string;
  score: number;
}

interface FinalHandEntry {
  playerName: string;
  cards: Card[];
}

interface ScoreItem {
  name: string;
  score: number;
}

interface FinalHandItem {
  playerName: string;
  cards: ClientCard[];
}

interface PlayerStatItem {
  name: string;
  numMatches: number;
  numPenalties: number;
}

interface EndOfGameModalProps {
  open: boolean;
  onClose: () => void;
  winner: string | string[];
  scores: ScoreItem[];
  finalHands?: FinalHandItem[];
  onPlayAgain: () => void;
  totalTurns?: number;
  playerStats?: PlayerStatItem[];
}

const EndOfGameModal: React.FC<EndOfGameModalProps> = ({ open, onClose, winner, scores, finalHands, onPlayAgain, totalTurns, playerStats }) => {
  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm transition-all"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full relative max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl font-bold focus:outline-none"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="flex flex-col items-center">
          <span className="text-4xl mb-2">🏆</span>
          <h2 className="text-xl font-bold mb-2">Winner{Array.isArray(winner) && winner.length > 1 ? 's' : ''}:</h2>
          <div className="mb-4 text-lg font-semibold text-blue-600">
            {Array.isArray(winner) ? winner.join(', ') : winner}
          </div>
          
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Final Scores:</h4>
            <ul className="space-y-1 text-xs">
              {scores.sort((a, b) => a.score - b.score).map((s, index) => (
                <li key={index} className={`flex justify-between p-1.5 rounded ${s.name === winner ? 'bg-green-100 dark:bg-green-700/30' : 'bg-gray-50 dark:bg-neutral-700/30'}`}>
                  <span className={s.name === winner ? 'font-bold text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}>{s.name}</span>
                  <span className={`font-semibold ${s.name === winner ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-gray-200'}`}>{s.score}</span>
                </li>
              ))}
            </ul>
          </div>

          {(typeof totalTurns === 'number' || (playerStats && playerStats.length > 0)) && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-neutral-600">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Round Statistics:</h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {typeof totalTurns === 'number' && (
                  <p>Total Turns Played: <span className="font-semibold text-gray-800 dark:text-gray-200">{totalTurns}</span></p>
                )}
                {playerStats && playerStats.length > 0 && (
                  <div className="mt-1">
                    <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-0.5">Player Stats:</h5>
                    <ul className="space-y-0.5">
                      {playerStats.map((stat, index) => (
                        <li key={index} className="p-1 bg-gray-50 dark:bg-neutral-700/30 rounded">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{stat.name}:</span>
                          <span className="ml-2">Matches: <span className="font-semibold text-green-600 dark:text-green-400">{stat.numMatches}</span></span>
                          <span className="ml-2">Penalties: <span className="font-semibold text-red-600 dark:text-red-400">{stat.numPenalties}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {finalHands && finalHands.length > 0 && (
            <div className="w-full mt-2 mb-4">
              <h3 className="text-md font-semibold mb-1.5 text-gray-700">Final Hands:</h3>
              {finalHands.map((handEntry, idx) => (
                <div key={`hand-${idx}`} className="mb-2.5 p-2 border border-gray-200 rounded-md">
                  <p className="text-xs font-medium text-gray-600 mb-1">{handEntry.playerName}</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {handEntry.cards.map((card, cardIdx) => (
                      <div key={card.id || cardIdx} className="w-full">
                        <CardComponent card={card} isFaceUp={true} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="w-full py-2.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg shadow mt-2 mb-1 transition-all"
            onClick={onPlayAgain}
          >
            Play Again
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EndOfGameModal; 