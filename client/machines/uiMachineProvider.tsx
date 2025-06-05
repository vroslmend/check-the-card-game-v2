'use client';

import React, { useEffect, createContext, useContext } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { uiMachine } from './uiMachine';
import { useSocket } from '@/context/SocketContext';
import { useGameStore } from '@/store/gameStore';
import {
  SocketEventName,
  ClientCheckGameState,
  RichGameLogMessage,
  ChatMessage,
  RespondCardDetailsPayload,
} from 'shared-types';
import { ActorRefFrom, InterpreterFrom } from 'xstate';

// 1. Create a standard React Context for the actor reference
const UIMachineContext = createContext<ActorRefFrom<typeof uiMachine> | null>(null);

// 2. Create our custom Provider component that orchestrates everything
export const UIMachineProvider = ({ children }: { children: React.ReactNode }) => {
  const { registerListener, emitEvent, isConnected } = useSocket();
  const gameStore = useGameStore();
  
  // Create a stable actor reference using the correct hook.
  // This hook creates and starts the actor for the component's lifetime.
  const actorRef = useActorRef(uiMachine);

  // EFFECT #1: Listening for events FROM the server
  useEffect(() => {
    if (!registerListener) {
      return; // Socket not ready yet
    }

    const cleanupFunctions: (() => void)[] = [];

    cleanupFunctions.push(
      registerListener(
        SocketEventName.GAME_STATE_UPDATE,
        (data: { gameState: ClientCheckGameState }) => {
          gameStore.setGameState(data.gameState);
        }
      )
    );

    cleanupFunctions.push(
      registerListener(
        SocketEventName.SERVER_LOG_ENTRY,
        (data: { logEntry: RichGameLogMessage }) => {
          gameStore.addLogMessage(data.logEntry);
          actorRef.send({ type: 'NEW_GAME_LOG', logMessage: data.logEntry });
        }
      )
    );

    cleanupFunctions.push(
      registerListener(
        SocketEventName.CHAT_MESSAGE,
        (chatMessage: ChatMessage) => {
          gameStore.addChatMessage(chatMessage);
          actorRef.send({ type: 'NEW_CHAT_MESSAGE', chatMessage });
        }
      )
    );

    cleanupFunctions.push(
      registerListener('serverError', (error: { message: string }) => {
        actorRef.send({ type: 'ERROR_RECEIVED', error: error.message });
      })
    );

    cleanupFunctions.push(
      registerListener(
        SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY,
        (data: RespondCardDetailsPayload) => {
          actorRef.send({ type: 'SERVER_PROVIDED_CARD_FOR_ABILITY', ...data });
        }
      )
    );

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [registerListener, gameStore, actorRef]);

  // EFFECT #2: Sending events TO the server
  useEffect(() => {
    const subscription = actorRef.on('EMIT_TO_SOCKET', (event: any) => {
      if (isConnected) {
        emitEvent(event.eventName, event.payload);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [actorRef, emitEvent, isConnected]);

  // Provide the actorRef we created to all children
  return (
    <UIMachineContext.Provider value={actorRef}>
      {children}
    </UIMachineContext.Provider>
  );
};

// 3. Export hooks that components will use. These now use the standard context.
export const useUIMachineRef = () => {
  const actorRef = useContext(UIMachineContext);
  if (!actorRef) {
    throw new Error('useUIMachineRef must be used within a UIMachineProvider');
  }
  return actorRef;
};

// Define the type of the interpreter to help the selector hook
type UIMachineInterpreter = InterpreterFrom<typeof uiMachine>;

export const useUIMachineSelector = <T,>(
  selector: (state: ReturnType<UIMachineInterpreter['getSnapshot']>) => T,
  equalityFn?: (a: T, b: T) => boolean
) => {
  const actorRef = useUIMachineRef();
  return useSelector(actorRef, selector, equalityFn);
};