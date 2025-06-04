'use client';

import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
// Import action types if you have them defined, e.g., from shared-types
// import type { PlayerAction, DrawFromDeckAction, PlayCardAction, ... } from '../../shared-types';

interface UsePlayerInputParams {
  socket: Socket | null; // Socket instance from useSocketManager or context
}

export const usePlayerInput = ({ socket }: UsePlayerInputParams) => {
  const emitPlayerAction = useCallback(
    (actionType: string, payload?: any) => {
      if (socket?.connected) {
        console.log(`Emitting player action: ${actionType}`, payload);
        socket.emit('playerAction', { type: actionType, payload }); // General action event
        // Or specific events: socket.emit(actionType, payload);
      } else {
        console.warn(
          `Socket not connected. Cannot send action: ${actionType}`,
        );
        // Handle error or queue action
      }
    },
    [socket],
  );

  // Example specific action functions
  const sendDrawFromDeckAction = useCallback(() => {
    emitPlayerAction('DRAW_FROM_DECK');
  }, [emitPlayerAction]);

  const sendPlayCardAction = useCallback(
    (cardId: string, targets?: string[]) => {
      emitPlayerAction('PLAY_CARD', { cardId, targets });
    },
    [emitPlayerAction],
  );

  const sendDeclareCheckAction = useCallback(() => {
    emitPlayerAction('DECLARE_CHECK');
  }, [emitPlayerAction]);

  // Add more functions for other player inputs like:
  // - sendChooseCharacterAction
  // - sendSelectCardForAbilityAction
  // - sendConfirmMatchAction
  // - sendSkipTurnAction (if applicable)
  // - etc.

  return {
    emitPlayerAction, // Generic emitter if needed
    sendDrawFromDeckAction,
    sendPlayCardAction,
    sendDeclareCheckAction,
    // Export other specific action functions
  };
}; 