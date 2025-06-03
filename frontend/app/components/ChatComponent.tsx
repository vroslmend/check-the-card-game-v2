'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ChatMessage } from 'shared-types';
import { FiMessageSquare, FiSend, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface ChatComponentProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId: string | null;
  isVisible?: boolean;
}

const ChatComponent: React.FC<ChatComponentProps> = ({ messages, onSendMessage, currentUserId, isVisible = true }) => {
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessagesLengthRef = useRef(messages.length);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const userHasManuallyScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
      userHasManuallyScrolledUpRef.current = false;
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container && messages.length > lastMessagesLengthRef.current) {
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
    lastMessagesLengthRef.current = messages.length;
  }, [messages]);

  const debouncedScrollHandler = useCallback(() => {
    const container = chatContainerRef.current;
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
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const scrollToBottom = () => {
    const container = chatContainerRef.current;
    if (container) {
      userHasManuallyScrolledUpRef.current = false;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
      setShowScrollToBottomButton(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && inputRef.current && isExpanded) {
      inputRef.current.focus();
    }
  }, [isVisible, isExpanded]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!isVisible) return null;

  return (
    <motion.div 
      className="fixed bottom-6 left-8 z-30 max-w-xs w-full custom-scrollbar bg-white/50 dark:bg-neutral-900/60 backdrop-blur-md rounded-lg shadow-lg border border-white/20 dark:border-neutral-700/60 text-xs font-sans overflow-hidden flex flex-col"
      initial={false}
      animate={{ 
        height: isExpanded ? '24rem' : '2.5rem',
      }}
      transition={{ 
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      layout
    >
      {/* Header */}
      <div 
        className="px-2.5 py-1.5 border-b border-white/10 dark:border-black/20 flex items-center justify-between flex-shrink-0 bg-white/20 dark:bg-black/20 cursor-pointer hover:bg-white/30 dark:hover:bg-black/30 transition-colors"
        onClick={toggleExpanded}
      >
        <h3 className="text-xs font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
          <FiMessageSquare className="w-3.5 h-3.5" />
          Chat
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {messages.length} messages
          </span>
          <motion.div
            initial={false}
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <FiChevronUp className="w-3.5 h-3.5 text-neutral-500" />
          </motion.div>
        </div>
      </div>

      {/* Content - Now wrapped with AnimatePresence and uses motion.div for smooth height animation */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="chat-content-area"
            className="flex flex-col flex-grow min-h-0 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1, 
              transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } 
            }}
            exit={{ 
              opacity: 0, 
              transition: { duration: 0.25, ease: [0.4, 0, 1, 1] }
            }}
          >
            {/* Message Area */}
            <div 
              ref={chatContainerRef} 
              onScroll={handleScroll}
              className="flex-grow overflow-y-auto p-2 space-y-1 relative bg-transparent scrollbar-thin scrollbar-thumb-neutral-400/50 dark:scrollbar-thumb-neutral-500/50 scrollbar-track-transparent hover:scrollbar-thumb-neutral-400 dark:hover:scrollbar-thumb-neutral-500 custom-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="text-neutral-500 dark:text-neutral-400 text-center py-2 h-full flex flex-col items-center justify-center text-[11px]">
                  <FiMessageSquare size={16} className="mb-1"/>
                  <p>No messages yet</p>
                </div>
              ) : (
                <div className="flex flex-col space-y-1">
                  <AnimatePresence initial={false}>
                    {messages.map((message) => {
                      const isCurrentUser = message.senderId === currentUserId;
                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ 
                            opacity: 1, 
                            y: 0, 
                            scale: 1,
                            transition: {
                              duration: 0.2,
                              ease: [0.25, 0.1, 0.25, 1]
                            }
                          }}
                          exit={{ 
                            opacity: 0, 
                            scale: 0.95,
                            transition: { duration: 0.15 }
                          }}
                          className={`flex items-start ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`px-2 py-1 rounded text-[11px] leading-snug break-words max-w-[85%] ${
                              isCurrentUser
                                ? 'bg-sky-500 text-white'
                                : 'bg-white/80 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100'
                            }`}
                          >
                            {!isCurrentUser && (
                              <span className="font-medium text-[10px] block mb-0.5 opacity-70">
                                {message.senderName}
                              </span>
                            )}
                            {message.message}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
              <AnimatePresence>
                {showScrollToBottomButton && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0, 
                      scale: 1,
                      transition: {
                        duration: 0.2,
                        ease: [0.25, 0.1, 0.25, 1]
                      }
                    }}
                    exit={{ 
                      opacity: 0, 
                      y: 10, 
                      scale: 0.9,
                      transition: { duration: 0.15 }
                    }}
                    className="sticky bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] leading-none bg-sky-500/90 hover:bg-sky-500 text-white rounded-full shadow-lg backdrop-blur-sm border border-sky-400/50 z-10 flex items-center gap-1"
                    onClick={scrollToBottom}
                  >
                    <FiChevronDown className="w-3 h-3" />
                    New messages
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-700/50 bg-white/30 dark:bg-neutral-800/30">
              <div className={`flex items-center gap-1 bg-white/80 dark:bg-neutral-800/80 rounded-md px-2 py-1 border transition-all duration-200 ${
                isFocused 
                  ? 'border-sky-500/50 dark:border-sky-400/50' 
                  : 'border-neutral-300/50 dark:border-neutral-600/50'
              }`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Type a message..."
                  className="flex-grow bg-transparent text-[11px] text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none min-w-0"
                  maxLength={500}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className={`p-1 rounded transition-all duration-200 ${
                    newMessage.trim()
                      ? 'text-sky-500 hover:bg-sky-500/10 hover:text-sky-600'
                      : 'text-neutral-400'
                  }`}
                >
                  <FiSend className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChatComponent;