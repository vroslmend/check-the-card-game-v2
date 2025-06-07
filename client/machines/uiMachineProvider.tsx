'use client';

import React, { useEffect, createContext, useContext } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { uiMachine } from './uiMachine';
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
  const { connect, emit, socket } = useGameStore();
  const actorRef = useActorRef(uiMachine);

  // EFFECT #1: Establish socket connection
  useEffect(() => {
    connect();
  }, [connect]);


  // EFFECT #2: Sending events TO the server
  useEffect(() => {
    const subscription = actorRef.on('EMIT_TO_SOCKET', (event: any) => {
      emit(event.eventName, event.payload);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [actorRef, emit]);

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