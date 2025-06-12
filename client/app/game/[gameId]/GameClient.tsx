'use client';

import React from 'react';
import GameUI from '@/components/game/GameUI';

/**
 * GameClient is now a simple, "dumb" component.
 * It's rendered by the Next.js page and its only job is to render the GameUI.
 * All complex logic regarding hydration, session management, and state
 * is now handled globally and correctly by the GameContext
 */
export default function GameClient() {
  return <GameUI />;
}