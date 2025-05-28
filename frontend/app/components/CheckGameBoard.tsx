import React from 'react';
import type { Ctx } from 'boardgame.io'; // Import Ctx type from boardgame.io
import type { CheckGameState as ActualCheckGameState, Card, PlayerState } from 'shared-types'; // Import your specific game state and related types

// Define the props for the game board
interface CheckGameBoardProps {
  G: (Omit<ActualCheckGameState, 'players'> & { players: { [playerID: string]: PlayerState } | {} }) | undefined;
  ctx: Ctx;
  playerID: string | null;
  moves: any; // TODO: Define a proper type for moves based on your game's moves
  // Add other props as needed, e.g., isActive, playerView, etc.
}

const CheckGameBoard: React.FC<CheckGameBoardProps> = ({ G, ctx, playerID, moves }) => {
  // Basic rendering to show some game state information
  // This will be significantly expanded to render the actual game

  if (!G) {
    // G might be undefined before it's initialized or if there's an issue
    return <div className="p-4">Loading game state or error...</div>;
  }

  return (
    <div className="game-board p-4 border border-gray-300 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Check Game Board</h2>
      
      <div className="mb-2">
        <strong>Current Phase:</strong> {ctx.phase}
      </div>
      <div className="mb-2">
        <strong>Current Player:</strong> {ctx.currentPlayer}
      </div>
      <div className="mb-4">
        <strong>Your Player ID:</strong> {playerID || 'Spectator'}
      </div>

      <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
        {JSON.stringify(G, null, 2)}
      </pre>

      {/* TODO: Add buttons for game moves here */}
      {/* TODO: Render player hands, discard pile, deck etc. */}
    </div>
  );
};

export default CheckGameBoard; 