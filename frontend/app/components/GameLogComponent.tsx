import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lastLogLengthRef = useRef(log.length);

  useEffect(() => {
    if (open && logContainerRef.current && log.length > lastLogLengthRef.current) {
      const container = logContainerRef.current;
      if (container.scrollHeight - container.scrollTop <= container.clientHeight + 20) {
        container.scrollTop = container.scrollHeight;
      }
    }
    lastLogLengthRef.current = log.length;
  }, [log, open]);

  return (
    <motion.div 
      layout 
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className={`fixed bottom-4 right-4 z-20 max-w-sm w-full flex flex-col items-end bg-transparent`}
    >
      <button
        className="mb-1 p-1.5 rounded-full bg-white dark:bg-neutral-700 shadow-md hover:bg-gray-100 dark:hover:bg-neutral-600 border border-gray-200 dark:border-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        aria-label={open ? 'Collapse game log' : 'Expand game log'}
        onClick={() => setOpen((v) => !v)}
      >
        <motion.span 
          className={`inline-block text-sm text-gray-700 dark:text-gray-300`}
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          ▶
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div 
            key="log-content-panel"
            ref={logContainerRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '18rem' }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 350, damping: 35, delay: 0.05 }}
            className={`styled-scrollbar-dark overflow-y-auto bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-gray-100 dark:border-neutral-700 p-2 text-xs font-sans text-gray-700 dark:text-gray-300 w-full`}
            aria-label="Game log panel"
          >
            {log.length === 0 ? (
              <div className="text-gray-400 dark:text-gray-500 text-center py-4">No events yet</div>
            ) : (
              <ul className="space-y-1">
                <AnimatePresence initial={false}>
                  {log.slice(-50).map((entry, i) => {
                    const key = `${entry.timestamp}-${entry.message}-${i}`;
                    let messageColor = 'dark:text-gray-300';
                    if (entry.type === 'error') {
                      messageColor = 'text-red-500 dark:text-red-400';
                    } else if (entry.type === 'system') {
                      messageColor = 'text-blue-500 dark:text-blue-400';
                    } else if (entry.type === 'player_action') {
                      messageColor = 'text-emerald-600 dark:text-emerald-400';
                    } else if (entry.type === 'game_event') {
                      messageColor = 'text-purple-500 dark:text-purple-400';
                    }

                    return (
                      <motion.li 
                        key={key}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
                        transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                        className="truncate hover:overflow-visible hover:white-space-normal text-xs"
                      >
                        <span className="text-gray-400 dark:text-gray-500 mr-1">{entry.timestamp ? `[${entry.timestamp}]` : ''}</span>
                        <span className={messageColor}>{entry.message}</span>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GameLogComponent; 