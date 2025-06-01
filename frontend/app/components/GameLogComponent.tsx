import React, { useState } from 'react';

interface GameLogMessage {
  message: string;
  timestamp?: string;
  type?: string;
}

interface GameLogComponentProps {
  log: GameLogMessage[];
}

const GameLogComponent: React.FC<GameLogComponentProps> = ({ log }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`fixed bottom-4 right-4 z-20 max-w-xs w-full transition-all ${open ? 'h-64' : 'h-10'} flex flex-col items-end`}>
      <button
        className="mb-1 p-1 rounded-full bg-white shadow hover:bg-gray-50 border border-gray-200 focus:outline-none"
        aria-label={open ? 'Collapse game log' : 'Expand game log'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>
      <div className={`overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-100 p-2 text-xs font-sans text-gray-700 w-full transition-all ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ minHeight: open ? '12rem' : 0 }}
        aria-label="Game log panel"
      >
        {log.length === 0 ? (
          <div className="text-gray-400 text-center py-4">No events yet</div>
        ) : (
          <ul className="space-y-1">
            {log.slice(-30).map((entry, i) => (
              <li key={i} className="truncate">
                <span className="text-gray-400 mr-1">{entry.timestamp ? `[${entry.timestamp}]` : ''}</span>
                <span>{entry.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GameLogComponent; 