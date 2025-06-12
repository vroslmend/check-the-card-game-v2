import React from 'react';
import GameClient from './GameClient';

// This interface defines the shape of the props Next.js 15 provides for this page.
// Note that `params` is a Promise.
interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

// The page component MUST be async to use await.
export default async function GamePage({ params }: GamePageProps) {
  // FIX: We must await the `params` promise to get the resolved object.
  const { gameId } = await params;

  // Now that we have the resolved `gameId`, we can pass it as a simple string
  // to the GameClient component, which is expecting a string, not a promise.
  return (
    <GameClient gameId={gameId} />
  );
}