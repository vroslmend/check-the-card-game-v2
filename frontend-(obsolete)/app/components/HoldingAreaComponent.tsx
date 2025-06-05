import React from 'react';
import { motion } from 'motion/react';
import type { ClientCard } from 'shared-types';
import CardComponent from './CardComponent'; // We'll switch back to this later

interface HoldingAreaComponentProps {
  cardToDisplay: ClientCard | null;
  showFaceUp: boolean;
  layoutId?: string | null;
  // For debug visuals:
  isDebugMode?: boolean;
  debugVisual: 'empty_slot' | 'placeholder_color' | 'actual_card_debug_color';
  debugColor?: string; // e.g., 'bg-red-500', 'bg-purple-500', 'bg-orange-400'
}

const HoldingAreaComponent: React.FC<HoldingAreaComponentProps> = ({
  cardToDisplay,
  showFaceUp,
  layoutId,
  isDebugMode = true, // Default to true for now
  debugVisual,
  debugColor,
}) => {
  const baseClasses = "w-12 md:w-14 aspect-[2.5/3.5] rounded-lg shadow-md";
  const emptySlotClasses = "ring-2 ring-accent bg-transparent";

  // The main motion.div for the slot, always present.
  // Its layoutId will be dynamic if one is passed for an incoming animation.
  const slotLayoutId = layoutId || "holding-area-permanent-slot";

  return (
    <motion.div
      layout // This component itself will manage its position if the parent uses flex/grid
      className="flex flex-col items-center overflow-hidden flex-shrink-0 p-1 origin-top"
      style={{ height: 105 }} // Matches existing style in CheckGameBoard
    >
      <motion.div
        key={slotLayoutId} // Key based on its primary function or dynamic layoutId
        layoutId={slotLayoutId}
        className={`flex items-center justify-center ${baseClasses} ${debugVisual === 'empty_slot' ? emptySlotClasses : ''} ${debugColor && (debugVisual === 'placeholder_color' || debugVisual === 'actual_card_debug_color') ? debugColor : ''}`}
        transition={{ // Keep the slowed down transition for now
          layout: { duration: 2, type: "spring", stiffness: 50, damping: 15 }
        }}
      >
        {isDebugMode && (debugVisual === 'placeholder_color' || debugVisual === 'actual_card_debug_color') && (
          // Debug color is applied by className above
          <div className="w-full h-full" />
        )}

        {!isDebugMode && cardToDisplay && !('isHidden' in cardToDisplay) && (
          <CardComponent
            card={cardToDisplay}
            isFaceUp={showFaceUp}
            isInteractive={false}
            disableHoverEffect={true}
          />
        )}
        {!isDebugMode && cardToDisplay && ('isHidden' in cardToDisplay) && (
            // Should represent a hidden card placeholder if not in debug mode
             <CardComponent
                card={cardToDisplay} // Will be a HiddenCard
                isFaceUp={false}
                isInteractive={false}
                disableHoverEffect={true}
            />
        )}
      </motion.div>
    </motion.div>
  );
};

export default HoldingAreaComponent; 