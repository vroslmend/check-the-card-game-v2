'use client';

import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
// import { useSocket } from '@/context/SocketContext'; // Removed unused import
import { useGameStore } from '@/store/gameStore';
import { PlayerActionType, SocketEventName } from 'shared-types';
import type { PlayerId, Card, AbilityArgs } from 'shared-types';

// Assuming ConcretePlayerActionEvents structure from shared-types is implicitly followed by constructing objects:
// type PlayerActionEvents = {
//   [K in PlayerActionType]: { type: K; playerId: string; } &
//     (K extends PlayerActionType.SWAP_AND_DISCARD ? { handIndex: number } :
//     K extends PlayerActionType.ATTEMPT_MATCH ? { handIndex: number } :
//     K extends PlayerActionType.REQUEST_PEEK_REVEAL ? { peekTargets: Array<{ playerID: string; cardIndex: number }> } :
//     K extends PlayerActionType.RESOLVE_SPECIAL_ABILITY ? { abilityResolutionArgs?: AbilityArgs & { skipAbility?: boolean; skipType?: 'peek' | 'swap' | 'full' } } :
//     Record<string, any>)
// };
// type ConcretePlayerActionEvents = PlayerActionEvents[PlayerActionType];

interface UsePlayerInputParams {
  socket: Socket | null;
  playerId: string | null; // Current player's ID is needed for action payloads
}

export const usePlayerInput = ({ socket, playerId }: UsePlayerInputParams) => {
  const emitPlayerAction = useCallback(
    (action: any /* ConcretePlayerActionEvents */) => { // Action should be a specific ConcretePlayerActionEvents object
      if (socket?.connected && playerId) {
        if (action.playerId !== playerId) {
          console.warn('Player ID in action does not match current player ID. Action not sent.', { actionPlayerId: action.playerId, hookPlayerId: playerId });
          return;
        }
        console.log(`Emitting player action:`, action);
        socket.emit(SocketEventName.PLAYER_ACTION, action);
      } else {
        console.warn(
          `Socket not connected or playerId not available. Cannot send action: ${action.type}`,
          { isConnected: socket?.connected, playerId },
        );
        // Handle error or queue action
      }
    },
    [socket, playerId],
  );

  const sendDrawFromDeckAction = useCallback(() => {
    if (!playerId) return;
    emitPlayerAction({ type: PlayerActionType.DRAW_FROM_DECK, playerId });
  }, [emitPlayerAction, playerId]);

  const sendDrawFromDiscardAction = useCallback(() => {
    if (!playerId) return;
    emitPlayerAction({ type: PlayerActionType.DRAW_FROM_DISCARD, playerId });
  }, [emitPlayerAction, playerId]);

  const sendSwapAndDiscardAction = useCallback(
    (handIndex: number) => {
      if (!playerId) return;
      emitPlayerAction({
        type: PlayerActionType.SWAP_AND_DISCARD,
        playerId,
        handIndex,
      });
    },
    [emitPlayerAction, playerId],
  );

  const sendDiscardDrawnCardAction = useCallback(() => {
    if (!playerId) return;
    emitPlayerAction({ type: PlayerActionType.DISCARD_DRAWN_CARD, playerId });
  }, [emitPlayerAction, playerId]);

  const sendAttemptMatchAction = useCallback(
    (handIndex: number) => {
      if (!playerId) return;
      emitPlayerAction({
        type: PlayerActionType.ATTEMPT_MATCH,
        playerId,
        handIndex,
      });
    },
    [emitPlayerAction, playerId],
  );

  const sendPassMatchAction = useCallback(() => {
    if (!playerId) return;
    emitPlayerAction({ type: PlayerActionType.PASS_MATCH, playerId });
  }, [emitPlayerAction, playerId]);

  const sendCallCheckAction = useCallback(() => {
    if (!playerId) return;
    emitPlayerAction({ type: PlayerActionType.CALL_CHECK, playerId });
  }, [emitPlayerAction, playerId]);

  const sendDeclareReadyForPeekAction = useCallback(() => {
    if (!playerId) return;
    emitPlayerAction({ type: PlayerActionType.DECLARE_READY_FOR_PEEK, playerId });
  }, [emitPlayerAction, playerId]);

  const sendRequestPeekRevealAction = useCallback(
    (peekTargets: Array<{ playerID: string; cardIndex: number }>) => {
      if (!playerId) return;
      emitPlayerAction({
        type: PlayerActionType.REQUEST_PEEK_REVEAL,
        playerId,
        peekTargets,
      });
    },
    [emitPlayerAction, playerId],
  );

  const sendResolveSpecialAbilityAction = useCallback(
    (abilityResolutionArgs?: AbilityArgs & { skipAbility?: boolean; skipType?: 'peek' | 'swap' | 'full' }) => {
      if (!playerId) return;
      emitPlayerAction({
        type: PlayerActionType.RESOLVE_SPECIAL_ABILITY,
        playerId,
        abilityResolutionArgs,
      });
    },
    [emitPlayerAction, playerId],
  );

  return {
    // emitPlayerAction, // Exposing this might be too generic if types aren't strictly enforced by caller
    sendDrawFromDeckAction,
    sendDrawFromDiscardAction,
    sendSwapAndDiscardAction,
    sendDiscardDrawnCardAction,
    sendAttemptMatchAction,
    sendPassMatchAction,
    sendCallCheckAction,
    sendDeclareReadyForPeekAction,
    sendRequestPeekRevealAction,
    sendResolveSpecialAbilityAction,
  };
};