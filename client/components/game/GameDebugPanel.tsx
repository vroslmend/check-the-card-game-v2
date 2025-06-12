'use client';

import { GameUIContext } from '@/context/GameUIContext';
import { socket } from '@/lib/socket';
import { Button } from "@/components/ui/button";
import { GameStage } from "shared-types";

const GameDebugPanel = () => {
  const uiState = GameUIContext.useSelector((s) => s);

  const debugInfo = {
    socket: {
      id: socket?.id,
      connected: uiState.tags.has('connected'),
    },
    session: {
      localPlayerId: uiState.context.localPlayerId,
      gameId: uiState.context.gameId,
    },
    uiMachine: {
      state: uiState.value,
      context: uiState.context,
    },
  };

  return (
    <div className="bg-muted/40 p-4 rounded-lg h-full overflow-y-auto">
      <h3 className="text-lg font-bold mb-2">Debug Panel</h3>
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-primary">Socket Info</h4>
          <p className="text-xs font-mono">ID: {debugInfo.socket.id || 'N/A'}</p>
          <p className="text-xs font-mono">Status: {debugInfo.socket.connected ? 'Connected' : 'Disconnected'}</p>
        </div>
        <div>
          <h4 className="font-semibold text-primary">Session</h4>
          <p className="text-xs font-mono">Game ID: {debugInfo.session.gameId || 'N/A'}</p>
          <p className="text-xs font-mono">Player ID: {debugInfo.session.localPlayerId || 'N/A'}</p>
        </div>
        <div>
          <h4 className="font-semibold text-primary">UI Machine State</h4>
          <p className="text-xs font-mono">Value: {JSON.stringify(debugInfo.uiMachine.state)}</p>
        </div>
        <div>
          <h4 className="font-semibold text-primary">UI Machine Context</h4>
          <pre className="text-xs bg-background p-2 rounded-md overflow-x-auto">
            {JSON.stringify(debugInfo.uiMachine.context, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default GameDebugPanel; 