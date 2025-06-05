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
  logId?: string;
}

interface GameLogComponentProps {
  log: GameLogMessage[];
}

const MAX_LOG_HEIGHT_REM = 9; // h-36, which is 9rem or 144px
const CONTAINER_PADDING_REM = 2.5 * 2 / 4; // p-2.5 on each side, converted to rem (1.25rem total for vertical)

const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) {
    return '';
  }
  const date = new Date(timestamp);
  if (!isNaN(date.getTime())) {
    // Successfully parsed as a date (likely ISO string)
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes.toString();
    const secondsStr = seconds < 10 ? '0' + seconds : seconds.toString();
    return `[${hours}:${minutesStr}:${secondsStr} ${ampm}]`;
  } else {
    // Not a parseable date string. It might be already formatted.
    // If it already starts with '[' and ends with ']', assume it's pre-formatted.
    if (timestamp.startsWith('[') && timestamp.endsWith(']')) {
        // Further check if it matches the hh:mm:ss am/pm pattern to avoid double bracketing
        // This regex is a bit lenient but should catch most cases like [12:34:56 am]
        if (/^\[\d{1,2}:\d{2}:\d{2} (am|pm)\]$/i.test(timestamp)) {
            return timestamp;
        }
    }
    // Otherwise, wrap it with brackets if it's not empty and not already correctly bracketed.
    return `[${timestamp.replace(/^\s*\[|\]\s*$/g, '')}]`; // Remove existing brackets before adding new ones, just in case
  }
};

const GameLogComponent: React.FC<GameLogComponentProps> = ({ log }) => {
  const animatedContainerRef = useRef<HTMLDivElement>(null); // Ref for the outer animating div
  const messageListWrapperRef = useRef<HTMLDivElement>(null); // Ref for the inner scrollable div
  const listUlRef = useRef<HTMLUListElement>(null); // Ref for the ul to measure its height

  const lastLogLengthRef = useRef(log.length);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const userHasManuallyScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentHeight, setCurrentHeight] = useState<string | number>('auto'); // For animating height

  useEffect(() => {
    const listElement = listUlRef.current;
    if (listElement && animatedContainerRef.current) { // check animatedContainerRef.current as well
      const contentHeight = listElement.scrollHeight;
      const computedStyle = getComputedStyle(animatedContainerRef.current);
      const paddingTop = parseFloat(computedStyle.paddingTop);
      const paddingBottom = parseFloat(computedStyle.paddingBottom);
      const paddingPx = paddingTop + paddingBottom;
      const targetHeight = Math.min(contentHeight + paddingPx, MAX_LOG_HEIGHT_REM * 16);
      setCurrentHeight(log.length === 0 ? (MAX_LOG_HEIGHT_REM * 16 * 0.3) : targetHeight); // Start smaller if empty
    }
  }, [log]);

  useEffect(() => {
    const container = messageListWrapperRef.current; // Scroll handling should be on the inner scrollable div
    if (container && log.length > lastLogLengthRef.current) {
      if (!userHasManuallyScrolledUpRef.current) {
        requestAnimationFrame(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'auto'
          });
        });
        setShowScrollToBottomButton(false);
      } else {
        if (container.scrollHeight > container.clientHeight) {
          setShowScrollToBottomButton(true);
        }
      }
    }
    lastLogLengthRef.current = log.length;
  }, [log]);

  const debouncedScrollHandler = useCallback(() => {
    const container = messageListWrapperRef.current;
    if (!container) return;

    const scrollAmountFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    const atExactBottom = Math.abs(scrollAmountFromBottom) < 15;
    const significantlyScrolledUp = scrollAmountFromBottom > 50;

    if (atExactBottom) {
      userHasManuallyScrolledUpRef.current = false;
      setShowScrollToBottomButton(false);
    } else if (significantlyScrolledUp) {
      userHasManuallyScrolledUpRef.current = true;
      if (container.scrollHeight > container.clientHeight) {
        setShowScrollToBottomButton(true);
      }
    } else {
      if (userHasManuallyScrolledUpRef.current && container.scrollHeight > container.clientHeight) {
        setShowScrollToBottomButton(true);
      } else if (!userHasManuallyScrolledUpRef.current) {
        setShowScrollToBottomButton(false);
      }
      if (!(container.scrollHeight > container.clientHeight)) {
        setShowScrollToBottomButton(false);
      }
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(debouncedScrollHandler, 50);
  }, [debouncedScrollHandler]);

  useEffect(() => {
    const container = messageListWrapperRef.current; // Event listener on inner scrollable div
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        if (messageListWrapperRef.current) { 
            messageListWrapperRef.current.removeEventListener('scroll', handleScroll);
        }
      };
    }
  }, [handleScroll]); 

  return (
    <motion.div
      key="compact-log-panel-animated"
      ref={animatedContainerRef} // Ref for outer div
      className={`fixed bottom-6 right-8 z-30 max-w-xs w-full custom-scrollbar overflow-hidden bg-white/50 dark:bg-neutral-900/60 backdrop-blur-md rounded-lg shadow-lg border border-white/20 dark:border-neutral-700/60 p-2.5 text-xs font-sans`} // Removed h-36, added overflow-hidden
      initial={{ height: MAX_LOG_HEIGHT_REM * 16 * 0.3 }} // Start smaller
      animate={{ height: currentHeight }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div 
        ref={messageListWrapperRef} // Ref for inner scrollable wrapper
        className="h-full w-full overflow-y-auto custom-scrollbar" // Takes full height of parent, becomes scrollable
      >
        {log.length === 0 ? (
          <div className="text-gray-500 dark:text-neutral-400 text-center py-4 h-full flex items-center justify-center">No events yet.</div>
        ) : (
          <ul className="space-y-1" ref={listUlRef}> {/* Ref for list to measure scrollHeight */}
            <AnimatePresence initial={false}>
              {log.slice(-25).map((entry, i) => { // Keep more logs for better height testing, can reduce later
                const key = entry.logId || `log-${i}-${entry.timestamp}-${entry.message.substring(0, 10)}`;
                let messageColor = 'text-gray-800 dark:text-neutral-200';

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
                    layout // Enable layout animation for list items
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 260, damping: 25 }} // Spring for a bit of bounce
                    className="flex items-start"
                  >
                    <span className="text-gray-500 dark:text-neutral-500 mr-1.5 whitespace-nowrap shrink-0 tabular-nums text-[0.9em]">{formatTimestamp(entry.timestamp)}</span>
                    <span className={`flex-grow ${messageColor} leading-snug break-words`}>{entry.message}</span> {/* Added break-words */}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
      <AnimatePresence>
        {showScrollToBottomButton && (
          <motion.button
            onClick={() => {
              const container = messageListWrapperRef.current; // Scroll button targets inner div
              if (container) {
                container.scrollTo({
                  top: container.scrollHeight,
                  behavior: 'smooth'
                });
                setShowScrollToBottomButton(false); 
              }
            }}
            className="absolute bottom-1.5 right-1.5 px-2.5 py-1 text-[0.7rem] leading-none bg-sky-500/90 hover:bg-sky-500 text-white rounded-full shadow-lg backdrop-blur-sm border border-sky-400/50 z-10" // Adjusted position to bottom-1.5 right-1.5
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