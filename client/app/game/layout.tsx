import React from 'react';
import { GameHeader } from '@/components/game/GameHeader';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <GameHeader />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
} 