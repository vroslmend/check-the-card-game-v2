'use client';

import { createContext, useContext, useMemo } from 'react';
// Correctly import the types from the machine file
import { type UIMachineActorRef, type UIMachineSnapshot } from '@/machines/uiMachine';
import { useSyncExternalStore } from 'react';

// Re-export the types so other files can use them
export type { UIMachineSnapshot, UIMachineActorRef };

// Create a standard React Context to hold our actor reference.
export const GameUIActorContext = createContext<UIMachineActorRef | null>(null);

/**
 * A hook to get the raw actor reference from the context.
 * Useful for sending events.
 */
export function useUIActorRef() {
  const actorRef = useContext(GameUIActorContext);
  if (!actorRef) {
    throw new Error('useUIActorRef must be used within a GameUIActorContext.Provider');
  }
  return actorRef;
}

/**
 * A hook to subscribe to the actor's state and select a part of it.
 * This is the equivalent of the `useSelector` that createActorContext provided.
 */
export function useUISelector<T>(
  selector: (snapshot: UIMachineSnapshot) => T,
  compare?: (a: T, b: T) => boolean
): T {
  const actorRef = useUIActorRef();

  const state = useSyncExternalStore(
    (onStoreChange) => {
      const subscription = actorRef.subscribe(onStoreChange);
      return () => subscription.unsubscribe();
    },
    () => actorRef.getSnapshot(),
    () => actorRef.getSnapshot()
  );

  // useMemo ensures the selector only re-runs when the state actually changes.
  return useMemo(() => selector(state), [state, selector]);
}