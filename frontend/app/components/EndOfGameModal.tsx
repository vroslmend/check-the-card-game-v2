import React from 'react';
import { Card } from 'shared-types';
import CardComponent from './CardComponent';

interface ScoreEntry {
  name: string;
  score: number;
}

interface FinalHandEntry {
  playerName: string;
  cards: Card[];
}

interface EndOfGameModalProps {
  open: boolean;
  onClose: () => void;
  winner: string | string[];
  scores: ScoreEntry[];
  finalHands?: FinalHandEntry[];
  onPlayAgain: () => void;
}

const EndOfGameModal: React.FC<EndOfGameModalProps> = ({ open, onClose, winner, scores, finalHands, onPlayAgain }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full relative animate-fade-in max-h-[90vh] overflow-y-auto">
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
          
          <h3 className="text-md font-semibold mt-3 mb-1 text-gray-700">Final Scores:</h3>
          <table className="w-full mb-4 text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pl-2">Player</th>
                <th className="text-right pr-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {scores.sort((a, b) => a.score - b.score).map((entry, i) => (
                <tr key={`score-${i}`} className="border-t border-gray-100">
                  <td className="py-1.5 pl-2 font-medium">{entry.name}</td>
                  <td className="py-1.5 pr-2 text-right">{entry.score}</td>
                </tr>
              ))}
            </tbody>
          </table>

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
      </div>
    </div>
  );
};

export default EndOfGameModal; 