'use client';

import React from 'react';
import { PlayingCard, cardSizeClasses } from '../cards/PlayingCard';
import type { Card } from 'shared-types';

interface DrawnCardAreaProps {
  card: Card;
  size?: keyof typeof cardSizeClasses;
}

export const DrawnCardArea = ({ card, size = 'xs' }: DrawnCardAreaProps) => {
  return (
    <PlayingCard card={card} className="card-fluid" size={size} />
  );
}; 