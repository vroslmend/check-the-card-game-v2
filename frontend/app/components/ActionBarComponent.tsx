import React from 'react';
import CardComponent from './CardComponent'; // Assuming CardComponent is in the same directory
import type { ClientCard } from 'shared-types';
import { GiCardDraw, GiCardPick } from 'react-icons/gi'; // Import chosen icons
import { motion } from 'motion/react'; // Import motion

interface Action {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode; // Changed from JSX.Element to React.ReactNode
  className?: string; // Allow custom styling for specific buttons
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
    <motion.div // Changed to motion.div for entrance animation
      className="fixed left-1/2 bottom-3 md:bottom-4 z-20 -translate-x-1/2 flex flex-col items-center w-full max-w-xs sm:max-w-sm md:max-w-md px-2"
      initial={{ y: 100, opacity: 0 }} // Initial: off-screen below and transparent
      animate={{ y: 0, opacity: 1 }}   // Animate: slide up and fade in
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }} // Spring animation with a slight delay
    >
      {/* Action Buttons Container */} 
      <div className={`flex flex-row items-center justify-center flex-wrap gap-1.5 p-1.5 bg-neutral-800/85 backdrop-blur-md rounded-full shadow-xl w-auto`}>
        {actions.map((action, i) => (
          <motion.button // Changed to motion.button for hover/tap animations
            key={i}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.label} // Tooltip for icon buttons
            className={`flex items-center justify-center p-2.5 md:p-3 rounded-full font-medium text-xs md:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent 
              ${action.disabled 
                ? 'bg-neutral-600/50 text-neutral-400/70 cursor-not-allowed' 
                : (action.className || 'bg-neutral-700/70 hover:bg-neutral-600/90 text-neutral-100')}
              ${action.icon ? 'w-10 h-10 md:w-12 md:h-12' : 'px-3 md:px-4'} // Adjust padding for icon vs text buttons
            `}
            whileHover={!action.disabled ? { scale: 1.1, boxShadow: "0px 0px 8px rgba(255,255,255,0.3)" } : {}}
            whileTap={!action.disabled ? { scale: 0.95 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 17 }} // For hover/tap
          >
            {action.icon ? action.icon : action.label}
          </motion.button>
        ))}
      </div>

      {/* Children for prompt text */} 
      {children && (
        <div className="mt-1.5 text-center p-1 bg-neutral-900/70 backdrop-blur-sm rounded-md shadow-md w-auto max-w-full">
          {children}
        </div>
      )}
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