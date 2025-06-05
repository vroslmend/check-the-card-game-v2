'use client';
import React, { useState } from 'react';
import { motion, LayoutGroup } from 'motion/react';

const MinimalLayoutTest: React.FC = () => {
  const [animateToTarget, setAnimateToTarget] = useState(false);

  return (
    <div className="p-4 border border-dashed border-neutral-500 rounded-lg my-4">
      <h2 className="text-lg font-semibold mb-2">Minimal Layout Animation Test (Single Element Morph)</h2>
      <button
        onClick={() => setAnimateToTarget(prev => !prev)}
        className="mb-4 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm"
      >
        Toggle Animation (Currently: {animateToTarget ? 'At Target Position' : 'At Initial Position'})
      </button>

      <LayoutGroup>
        <div className="relative w-[500px] h-24 bg-neutral-200 dark:bg-neutral-700 rounded-md p-2 flex items-center">
          {/* Single Morphing Square */}
          <motion.div
            layout // Enable layout animations
            layoutId="morphing-square" // Consistent layoutId, the magic is in changing styles/props
            className="w-20 h-20 rounded flex items-center justify-center text-white text-xs"
            animate={{
              x: animateToTarget ? 380 : 0, // Increased distance: 0 to 380
              backgroundColor: animateToTarget ? '#3b82f6' : '#ef4444', // Blue : Red
            }}
            initial={false} // To prevent initial animation from 0,0 if x is not set in initial
            transition={{
              type: "spring",
              stiffness: 120,
              damping: 20,
            }}
            style={{ position: 'absolute' }} // Position absolute to allow x to move it freely
          >
            {animateToTarget ? 'Blue' : 'Red'}
          </motion.div>
        </div>
      </LayoutGroup>
      <p className="text-xs mt-2 text-neutral-400">
        Square is now: {animateToTarget ? 'Blue at x=380' : 'Red at x=0'}
      </p>
    </div>
  );
};

export default MinimalLayoutTest; 