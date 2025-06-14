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
      layout
      className="fixed left-1/2 bottom-3 md:bottom-4 z-[1000] -translate-x-1/2 flex flex-col items-center w-full max-w-xs sm:max-w-sm md:max-w-md px-2"
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ 
        layout: { type: "spring", stiffness: 400, damping: 35, delay: 0 },
        y: { type: "spring", stiffness: 400, damping: 28 },
        opacity: { duration: 0.2 }
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className={"flex flex-row items-center justify-center flex-wrap gap-1.5 p-1.5 bg-neutral-800/70 dark:bg-zinc-800/70 backdrop-blur-md rounded-full shadow-xl w-auto"}
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
            key={React.isValidElement(children) ? children.key : 'static-prompt-key'}
            className="mt-1.5 flex flex-col items-center gap-0.5 text-center p-1 bg-neutral-900/70 backdrop-blur-sm rounded-md shadow-md w-auto max-w-xs sm:max-w-sm"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ActionBarComponent; 