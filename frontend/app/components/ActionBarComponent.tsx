import React from 'react';
import CardComponent from './CardComponent'; // Assuming CardComponent is in the same directory
import type { ClientCard } from 'shared-types';
import { GiCardDraw, GiCardPick } from 'react-icons/gi'; // Import chosen icons
import { motion, AnimatePresence } from 'motion/react'; // Import motion and AnimatePresence

interface Action {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode; // Changed from JSX.Element to React.ReactNode
  className?: string; // Allow custom styling for specific buttons
  isLoading?: boolean; // New prop
}

interface ActionBarComponentProps {
  actions: Action[];
  children?: React.ReactNode; // For any additional UI elements like prompt text
}

// Basic SVG Icons (can be replaced with a library or more detailed SVGs)
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
      {/* Action Buttons Container - now a motion.div with layout */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }} // You might want to tune this transition
        className={`flex flex-row items-center justify-center flex-wrap gap-1.5 p-1.5 bg-neutral-800/85 backdrop-blur-md rounded-full shadow-xl w-auto`}
      >
        {actions.map((action, i) => (
          <motion.button
            key={i}
            onClick={action.onClick}
            disabled={action.disabled || action.isLoading}
            title={action.label}
            className={`group flex items-center justify-center p-2.5 md:p-3 rounded-full font-medium text-xs md:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent 
              ${(action.disabled || action.isLoading) 
                ? 'bg-neutral-600/50 text-neutral-400/70 cursor-not-allowed' 
                : (action.className || 'bg-neutral-700/70 hover:bg-neutral-600/90 text-neutral-100')}
              ${action.icon && !action.isLoading ? 'w-10 h-10 md:w-12 md:h-12' : 'px-3 md:px-4'} 
            `}
            whileHover={!(action.disabled || action.isLoading) ? { scale: 1.1, boxShadow: "0px 0px 8px rgba(255,255,255,0.3)" } : {}}
            whileTap={!(action.disabled || action.isLoading) ? { scale: 0.95 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {action.isLoading ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : action.icon ? (
              <motion.span 
                className="transition-transform duration-150 ease-in-out group-hover:scale-125 group-hover:rotate-[-5deg]"
              >
                {action.icon}
              </motion.span>
            ) : action.label}
          </motion.button>
        ))}
      </motion.div>

      {/* Children for prompt text */} 
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

// Helper to create action props with icons
export const createDrawDeckAction = (onClick: () => void, disabled?: boolean) => ({
  label: 'Draw from Deck',
  onClick,
  disabled,
  icon: DrawDeckIcon,
});

export const createDrawDiscardAction = (onClick: () => void, disabled?: boolean) => ({
  label: 'Draw from Discard',
  onClick,
  disabled,
  icon: DiscardPileIcon,
});

export default ActionBarComponent; 