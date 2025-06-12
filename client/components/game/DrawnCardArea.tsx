'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayingCard } from '../cards/PlayingCard';
import type { Card } from 'shared-types';

interface DrawnCardAreaProps {
  card: Card | { facedown: true };
}

export const DrawnCardArea = ({ 
  card
}: DrawnCardAreaProps) => {
  // Responsive card size
  const [cardSize, setCardSize] = useState<'sm' | 'md'>('sm');
  
  useEffect(() => {
    const handleResize = () => {
      setCardSize(window.innerWidth < 768 ? 'sm' : 'md');
    };
    
    // Set initial size
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative">
      {/* Card in holding area */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="relative">
          <PlayingCard 
            card={'facedown' in card ? undefined : card}
            size={cardSize}
            faceDown={'facedown' in card}
            className="shadow-sm"
          />
        </div>
      </motion.div>
    </div>
  );
}; 