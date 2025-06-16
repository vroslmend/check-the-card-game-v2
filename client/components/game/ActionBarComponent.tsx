import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from './ActionButton';
import Magnetic from '@/components/ui/Magnetic';

export interface Action {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  isProgressButton?: boolean;
  progressPercent?: number;
  progressFillClassName?: string;
  progressLabelClassName?: string;
}

interface ActionBarComponentProps {
  actions: Action[];
  children?: React.ReactNode;
}

const ActionBarComponent: React.FC<ActionBarComponentProps> = ({ actions, children }) => {
  return (
    <motion.div 
      className="flex flex-col items-center w-full"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ 
        y: { type: "spring", stiffness: 400, damping: 28 },
        opacity: { duration: 0.2 }
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className="flex flex-row items-center justify-center flex-wrap gap-2 p-2 bg-black/20 backdrop-blur-xl rounded-full shadow-lg ring-1 ring-inset ring-white/10"
      >
        {actions.map((action, i) => (
          <Magnetic key={action.label || i} strength={20}>
            <ActionButton action={action} />
          </Magnetic>
        ))}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {children && (
          <motion.div
            layout
            key="prompt-text"
            className="mt-2 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ActionBarComponent; 