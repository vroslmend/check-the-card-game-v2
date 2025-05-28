'use client'; // This directive is necessary for components using Client components from boardgame.io or React hooks

import React from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { type Ctx } from 'boardgame.io'; // Removed 'type Game' as it's not directly used here after removing the cast
import { CheckGame } from '../lib/server-game-exports'; // Renamed ImportedCheckGame back to CheckGame
import CheckGameBoard from './CheckGameBoard';
// import type { CheckGameState as ActualCheckGameState } from 'shared-types'; // Not directly needed here if not casting

// Define the props for the boardgame.io Client component
interface CheckGameClientProps {
  playerID?: string; // Optional playerID, if not provided, will be spectator or assigned by lobby
  matchID?: string; // Optional matchID to connect to a specific game
}

const CheckGameClient: React.FC<CheckGameClientProps> = ({ playerID, matchID = 'default' }) => {
  // The Client component from boardgame.io will manage the game state and connection
  // It expects the game definition (CheckGame) and the board component (CheckGameBoard)

  const GameClient = Client({
    game: CheckGame, // Use the imported CheckGame directly
    board: CheckGameBoard, // Your React component for the game board
    multiplayer: SocketIO({ server: 'localhost:8000' }), // Configure for multiplayer via Socket.IO
    // playerID: playerID, // If you want to assign a player ID from props
    // matchID: matchID, // If you want to connect to a specific match from props
    debug: true, // Enable debug panel (useful during development)
  });

  // Render the boardgame.io client. It will handle rendering the board.
  // If a specific playerID is passed, it attempts to connect as that player.
  // If no playerID, it might connect as a spectator or let the lobby handle assignment.
  if (playerID) {
    return <GameClient playerID={playerID} matchID={matchID} />;
  }
  return <GameClient matchID={matchID} />; // Connect as spectator or let lobby handle player ID

};

export default CheckGameClient; 