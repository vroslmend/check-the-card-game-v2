'use client';

import React, { createContext, useEffect, useContext } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { socket } from '@/lib/socket';
import {
  uiMachine,
  type UIMachineActorRef,
  type UIMachineSnapshot,
} from '@/machines/uiMachine';
import {
  type ClientCheckGameState,
  type RichGameLogMessage,
  SocketEventName,
  type Card,
  type PlayerId,
} from 'shared-types';

type UIContextType = {
  actorRef: UIMachineActorRef;
};

export const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIMachineProvider = ({
  children,
  gameId,
  localPlayerId,
  initialGameState,
}: {
  children: React.ReactNode;
  gameId: string;
  localPlayerId: string;
  initialGameState?: ClientCheckGameState;
}) => {
  const getInitialState = () => {
    // If we've been given a fresh initial state from server props, use it.
    if (initialGameState) {
      return { state: undefined, source: 'prop' };
    }

    // Otherwise, try to get it from sessionStorage, which is where the
    // create/join modals will place it.
    try {
      const persistedStateJSON = sessionStorage.getItem('initialGameState');
      if (persistedStateJSON) {
        const state = JSON.parse(persistedStateJSON);
        // Basic validation: ensure it's for the right game.
        if (state.gameId === gameId) {
          // Clear the state so it's only used once for initialization
          sessionStorage.removeItem('initialGameState');
          return { state, source: 'sessionStorage' };
        }
      }
    } catch (e) {
      console.error('Failed to read persisted state from sessionStorage', e);
    }

    // If no state is found, we'll need to reconnect.
    return { state: undefined, source: 'none' };
  };

  const { state: hydratedState, source } = getInitialState();

  const actorRef = useActorRef(uiMachine, {
    input: {
      gameId,
      localPlayerId,
      // Pass the state we found, whether from props or sessionStorage
      initialGameState: initialGameState ?? hydratedState,
    },
  });

  useEffect(() => {
    // We only need to explicitly reconnect if we didn't get state from any source.
    // This typically happens on a page refresh.
    if (source === 'none') {
      actorRef.send({ type: 'RECONNECT' });
    }
  }, [actorRef, source]);

  useEffect(() => {
    const onGameStateUpdate = (gameState: ClientCheckGameState) => {
      actorRef.send({ type: 'CLIENT_GAME_STATE_UPDATED', gameState });
    };
    const onNewLog = (logMessage: RichGameLogMessage) => {
      actorRef.send({ type: 'NEW_GAME_LOG', logMessage });
    };
    const onInitialPeek = (data: { hand: Card[] }) => {
      actorRef.send({ type: 'INITIAL_PEEK_INFO', hand: data.hand });
    };
    const onCardDetails = (payload: { card: Card; playerId: PlayerId; cardIndex: number }) => {
      actorRef.send({ type: 'ABILITY_PEEK_RESULT', ...payload });
    };
    const onError = (error: { message: string }) => {
      actorRef.send({ type: 'ERROR_RECEIVED', error: error.message });
    };
    const onInitialLogs = (logs: RichGameLogMessage[]) => {
      actorRef.send({ type: 'INITIAL_LOGS_RECEIVED', logs });
    };

    socket.on(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
    socket.on(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
    socket.on(SocketEventName.INITIAL_PEEK_INFO, onInitialPeek);
    socket.on(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
    socket.on(SocketEventName.ERROR_MESSAGE, onError);
    socket.on(SocketEventName.INITIAL_LOGS, onInitialLogs);


    return () => {
      socket.off(SocketEventName.GAME_STATE_UPDATE, onGameStateUpdate);
      socket.off(SocketEventName.SERVER_LOG_ENTRY, onNewLog);
      socket.off(SocketEventName.INITIAL_PEEK_INFO, onInitialPeek);
      socket.off(SocketEventName.ABILITY_PEEK_RESULT, onCardDetails);
      socket.off(SocketEventName.ERROR_MESSAGE, onError);
      socket.off(SocketEventName.INITIAL_LOGS, onInitialLogs);
    };
  }, [actorRef]);

  // It subscribes to specific events emitted by the machine and forwards them to the socket.
  // This is the preferred, type-safe way to handle emitted events from an actor.
  useEffect(() => {
    const subscription = actorRef.on('EMIT_TO_SOCKET', (event) => {
      if (event.ack) {
        socket.emit(event.eventName, event.payload, event.ack);
      } else {
        socket.emit(event.eventName, event.payload);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [actorRef]);

  return <UIContext.Provider value={{ actorRef }}>{children}</UIContext.Provider>;
};

export const useUI = (): [UIMachineSnapshot, UIMachineActorRef['send']] => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIMachineProvider');
  }
  const state = useSelector(context.actorRef, (s) => s);
  return [state, context.actorRef.send];
};