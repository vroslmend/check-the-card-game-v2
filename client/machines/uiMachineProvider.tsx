'use client';

import React, { useEffect, createContext, useContext } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { uiMachine } from './uiMachine';
import { useGameStore } from '@/store/gameStore';
import { type ActorRefFrom } from 'xstate';
import { SocketEventName, type RespondCardDetailsPayload, type ClientCheckGameState } from 'shared-types';

type UIContextType = {
  actor: ActorRefFrom<typeof uiMachine>;
  state: ReturnType<ActorRefFrom<typeof uiMachine>['getSnapshot']>;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIMachineProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket, emit, currentGameState, isConnected } = useGameStore((state) => ({
    socket: state.socket,
    emit: state.emit,
    currentGameState: state.currentGameState,
    isConnected: state.socket?.connected,
  }));

  const actorRef = useActorRef(uiMachine);

  // Syncs the Zustand store's full game state with the UI machine's context
  useEffect(() => {
    if (currentGameState) {
      actorRef.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState: currentGameState });
    }
  }, [currentGameState, actorRef]);

  // Listens for events emitted from the UI machine and sends them to the socket
  useEffect(() => {
    if (!isConnected) return;

    const subscription = actorRef.on('*', (emitted) => {
      if (emitted.type === 'EMIT_TO_SOCKET') {
        emit(emitted.eventName, emitted.payload);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConnected, actorRef, emit]);

  // Listens for specific server events to forward to the UI machine
  useEffect(() => {
    if (!socket) return;

    const handleServerEvent = (payload: RespondCardDetailsPayload) => {
      actorRef.send({
        type: 'SERVER_PROVIDED_CARD_FOR_ABILITY',
        card: payload.card,
        playerId: payload.playerId,
        cardIndex: payload.cardIndex,
      });
    };

    socket.on(SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY, handleServerEvent);

    return () => {
      socket.off(SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY, handleServerEvent);
    };
  }, [socket, actorRef]);

  const state = useSelector(actorRef, (snapshot) => snapshot);

  return <UIContext.Provider value={{ actor: actorRef, state }}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIMachineProvider');
  }
  return context;
};