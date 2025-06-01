import React from 'react';

interface ScoreEntry {
  name: string;
  score: number;
}

interface EndOfGameModalProps {
  open: boolean;
  onClose: () => void;
  winner: string | string[];
  scores: ScoreEntry[];
  onPlayAgain: () => void;
}

const EndOfGameModal: React.FC<EndOfGameModalProps> = ({ open, onClose, winner, scores, onPlayAgain }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full relative animate-fade-in">
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
          <table className="w-full mb-4 text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left">Player</th>
                <th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1 font-medium">{entry.name}</td>
                  <td className="py-1 text-right">{entry.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="w-full py-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg shadow mb-2 transition-all"
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