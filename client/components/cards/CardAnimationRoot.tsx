import { LayoutGroup } from 'framer-motion';
import React from 'react';

export default function CardAnimationRoot({ children }: { children: React.ReactNode }) {
  return <LayoutGroup id="cards">{children}</LayoutGroup>;
} 