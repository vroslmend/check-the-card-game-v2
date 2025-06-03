import React, { useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import type { Action } from './ActionBarComponent'; // Assuming Action type is exported from ActionBarComponent or defined in a shared types file

interface ActionButtonProps {
  action: Action;
}

const ActionButton: React.FC<ActionButtonProps> = ({ action }) => {
  const animationControls = useAnimation();

  useEffect(() => {
    if (action.isProgressButton) {
      animationControls.start({
        width: `${action.progressPercent || 0}%`,
        transition: { 
          type: "spring", 
          stiffness: 100, // Moderate stiffness
          damping: 30,    // Good damping ratio for smoothness
          mass: 1
          // No explicit duration for spring, it's physics-based
        }
      });
    } else {
      // If it needs to revert or handle non-progress states, do it here.
      // For instance, if a button could stop being a progress bar:
      // animationControls.start({ width: '0%' }); // Or some initial/default state
    }
  }, [action.progressPercent, action.isProgressButton, animationControls]);

  return (
    <motion.button
      onClick={action.onClick}
      disabled={action.disabled || action.isLoading}
      title={action.label}
      className={`group relative flex items-center justify-center p-2.5 md:p-3 rounded-full font-medium text-xs md:text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent overflow-hidden 
        ${
          (action.disabled || action.isLoading) 
            ? 'bg-neutral-600/50 text-neutral-400/70 cursor-not-allowed' // Disabled style
            : action.className || 'bg-neutral-700/70 hover:bg-neutral-600/90 text-neutral-100' // Default active style (this is the track for progress button)
        }
        ${
          action.icon && !action.isLoading && !action.isProgressButton 
          ? 'w-10 h-10 md:w-12 md:h-12' 
          : 'px-3 md:px-4'
        } 
      `}
      whileHover={!(action.disabled || action.isLoading) ? { scale: 1.1, boxShadow: "0px 0px 8px rgba(255,255,255,0.3)" } : {}}
      whileTap={!(action.disabled || action.isLoading) ? { scale: 0.95 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {action.isProgressButton && (
        <motion.div
          className={`absolute top-0 left-0 h-full ${action.progressFillClassName || 'bg-yellow-500/70'}`}
          initial={{ width: '0%' }}
          animate={animationControls}
        />
      )}
      <span className={`relative z-10 ${ (action.isProgressButton && action.progressLabelClassName) ? action.progressLabelClassName : '' }`}> 
        {action.isLoading ? (
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : action.icon && !action.isProgressButton ? (
          <motion.span 
            className="transition-transform duration-150 ease-in-out group-hover:scale-125 group-hover:rotate-[-5deg]"
          >
            {action.icon}
          </motion.span>
        ) : (
          action.label
        )}
      </span>
    </motion.button>
  );
};

export default ActionButton; 