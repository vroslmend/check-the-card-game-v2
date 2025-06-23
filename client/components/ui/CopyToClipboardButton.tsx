'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyToClipboardButtonProps {
  textToCopy: string | null | undefined;
  className?: string;
  buttonText?: string;
}

export const CopyToClipboardButton = ({ textToCopy, className, buttonText }: CopyToClipboardButtonProps) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (textToCopy && !copied) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded-md shadow-lg pointer-events-none z-10"
          >
            Copied!
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={handleCopy}
        className={cn(
          'flex items-center gap-2 bg-stone-100/70 hover:bg-stone-100/90 dark:bg-zinc-800/70 dark:hover:bg-zinc-800/90 px-3 py-1.5 rounded-full transition-colors',
          'font-mono text-xs text-stone-700 dark:text-stone-300',
          className
        )}
        disabled={copied}
        data-cursor-link
      >
        <span>{buttonText || textToCopy || '...'}</span>
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Copy className="h-3.5 w-3.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}; 