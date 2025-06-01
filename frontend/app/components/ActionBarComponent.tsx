import React from 'react';
import CardComponent from './CardComponent'; // Assuming CardComponent is in the same directory
import type { ClientCard } from 'shared-types';

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
const DrawDeckIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeDasharray="4 2" strokeOpacity="0.6" />
    <path d="M12 16L12 8" />
    <path d="M9 11L12 8L15 11" />
    <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fill="currentColor" dy=".1em">?</text>
  </svg>
);

const DiscardPileIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeOpacity="0.6" />
    <path d="M12 8L12 16" />
    <path d="M9 13L12 16L15 13" />
  </svg>
);

const ActionBarComponent: React.FC<ActionBarComponentProps> = ({ actions, children }) => {
  return (
    // Slimmed down fixed bar
    <div className="fixed left-1/2 bottom-3 md:bottom-4 z-20 -translate-x-1/2 flex flex-col items-center w-full max-w-xs sm:max-w-sm md:max-w-md px-2">
      {/* Action Buttons Container */} 
      <div className={`flex flex-row items-center justify-center flex-wrap gap-1.5 p-1.5 bg-neutral-800/85 backdrop-blur-md rounded-full shadow-xl w-auto`}>
        {actions.map((action, i) => (
          <button
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
          >
            {action.icon ? action.icon : action.label}
          </button>
        ))}
      </div>

      {/* Children for prompt text */} 
      {children && (
        <div className="mt-1.5 text-center p-1 bg-neutral-900/70 backdrop-blur-sm rounded-md shadow-md w-auto max-w-full">
          {children}
        </div>
      )}
    </div>
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