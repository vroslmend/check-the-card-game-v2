import React from 'react';
import { GiCardDraw, GiCardPick } from 'react-icons/gi';
import { motion, AnimatePresence } from 'motion/react';
import ActionButton from './ActionButton';

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

const DrawDeckIcon = <GiCardDraw size={20} />;
const DiscardPileIcon = <GiCardPick size={20} />;

const ActionBarComponent: React.FC<ActionBarComponentProps> = ({ actions, children }) => {
  return (
    <motion.div 
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0 }}
      className="fixed left-1/2 bottom-3 md:bottom-4 z-20 -translate-x-1/2 flex flex-col items-center w-full max-w-xs sm:max-w-sm md:max-w-md px-2"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`flex flex-row items-center justify-center flex-wrap gap-1.5 p-1.5 bg-neutral-800/85 backdrop-blur-md rounded-full shadow-xl w-auto`}
      >
        {actions.map((action, i) => (
          <ActionButton key={action.label || i} action={action} />
        ))}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {children && (
          <motion.div
            layout
            key={React.isValidElement(children) ? children.key : 'static-prompt-key'}
            className="mt-1.5 text-center p-1 bg-neutral-900/70 backdrop-blur-sm rounded-md shadow-md w-auto max-w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const createDrawDeckAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Draw from Deck',
  onClick,
  disabled,
  icon: DrawDeckIcon,
});

export const createDrawDiscardAction = (onClick: () => void, disabled?: boolean): Action => ({
  label: 'Draw from Discard',
  onClick,
  disabled,
  icon: DiscardPileIcon,
});

export default ActionBarComponent; 