import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
// Icons removed for this version as we are focusing on text-only display
// import { FiInfo, FiAlertCircle, FiUserCheck, FiZap, FiChevronRight } from 'react-icons/fi';

interface GameLogMessage {
  message: string;
  timestamp?: string;
  type?: 'system' | 'player_action' | 'game_event' | 'error' | 'info'; // Added 'info' for general non-error system messages
  actorName?: string; // e.g., player who performed the action
  targetName?: string; // e.g., player targeted by an action
  // We can add more structured fields later, like card details
}

interface GameLogComponentProps {
  log: GameLogMessage[];
}

const GameLogComponent: React.FC<GameLogComponentProps> = ({ log }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lastLogLengthRef = useRef(log.length);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  useEffect(() => {
    const container = logContainerRef.current;
    if (container && log.length > lastLogLengthRef.current) {
      // A new message has arrived
      const isScrolledToBottom = Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 10;

      if (isScrolledToBottom) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
        setShowScrollToBottomButton(false); 
      } else {
        // New message and user is not at the bottom
        if (container.scrollHeight > container.clientHeight) { // Only show button if actually scrollable
          setShowScrollToBottomButton(true);
        }
      }
    }
    // Always update the last log length after processing
    lastLogLengthRef.current = log.length;
  }, [log]);

  const handleScroll = useCallback(() => {
    const container = logContainerRef.current;
    if (container) {
      const isAtBottom = Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 10;
      if (isAtBottom) {
        setShowScrollToBottomButton(false);
      }
      // If user scrolls up and new messages have arrived (button is visible),
      // it should remain visible. This is handled by the log useEffect.
    }
  }, []); 

  useEffect(() => {
    const container = logContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        // Check if container still exists on cleanup, common in React StrictMode
        if (logContainerRef.current) { 
            logContainerRef.current.removeEventListener('scroll', handleScroll);
        }
      };
    }
  }, [handleScroll]); 

  return (
    <motion.div
      key="compact-log-panel"
      ref={logContainerRef}
      className={`fixed bottom-6 right-8 z-30 max-w-xs w-full h-36 custom-scrollbar overflow-y-auto bg-white/50 dark:bg-neutral-900/60 backdrop-blur-md rounded-lg shadow-lg border border-white/20 dark:border-neutral-700/60 p-2.5 text-xs font-sans`} // Adjusted transparency and blur
      // Adjusted background for better dark mode contrast with text, slightly more padding, stronger shadow
    >
      {log.length === 0 ? (
        <div className="text-gray-500 dark:text-neutral-400 text-center py-4 h-full flex items-center justify-center">No events yet.</div>
      ) : (
        <ul className="space-y-1"> {/* Increased space-y slightly for readability */}
          <AnimatePresence initial={false}>
            {log.slice(-15).map((entry, i) => {
              const key = `${entry.timestamp}-${entry.message}-${i}`;
              let messageColor = 'text-gray-800 dark:text-neutral-200'; // Default message color

              if (entry.type === 'error') {
                messageColor = 'text-red-600 dark:text-red-400 font-semibold';
              } else if (entry.type === 'system') {
                messageColor = 'text-sky-600 dark:text-sky-400';
              } else if (entry.type === 'player_action') {
                messageColor = 'text-emerald-600 dark:text-emerald-400';
              } else if (entry.type === 'game_event') {
                messageColor = 'text-purple-600 dark:text-purple-400';
              }

              return (
                <motion.li
                  key={key}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }} // Simplified exit
                  transition={{ type: 'spring', stiffness: 280, damping: 28, delay: Math.min(0.03 * i, 0.3) }} // Capped delay
                  className="flex items-start"
                >
                  <span className="text-gray-500 dark:text-neutral-500 mr-1.5 whitespace-nowrap shrink-0 tabular-nums text-[0.9em]">{entry.timestamp ? `[${entry.timestamp}]` : ''}</span>
                  <span className={`flex-grow ${messageColor} leading-snug`}>{entry.message}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <AnimatePresence>
        {showScrollToBottomButton && (
          <motion.button
            onClick={() => {
              const container = logContainerRef.current;
              if (container) {
                container.scrollTo({
                  top: container.scrollHeight,
                  behavior: 'smooth'
                });
                // Optimistically hide; handleScroll will confirm if not quite at bottom.
                setShowScrollToBottomButton(false); 
              }
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[0.7rem] leading-none bg-sky-500/90 hover:bg-sky-500 text-white rounded-full shadow-lg backdrop-blur-sm border border-sky-400/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            Scroll to latest
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GameLogComponent; 