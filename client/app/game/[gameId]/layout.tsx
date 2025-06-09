import React, { use } from 'react';
import GameClient from './GameClient'; // Create a new client component

export default function GameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = use(params);

  return (
    <GameClient gameId={gameId}>
      {children}
    </GameClient>
  );
} 