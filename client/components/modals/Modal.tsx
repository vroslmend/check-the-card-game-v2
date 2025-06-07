'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import TiltCard from '@/components/ui/TiltCard'; 
import { Button } from '@/components/ui/button';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20 backdrop-blur-xl"
      onClick={onClose}
    >
      <TiltCard>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 400,
            duration: 0.4,
          }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-stone-200/20 bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-stone-800/20 dark:bg-stone-900/95"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="absolute right-4 top-4"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
          {children}
        </motion.div>
      </TiltCard>
    </motion.div>
  );
};

export default Modal; 