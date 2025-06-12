'use client';

import { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext } from '@/components/providers/UIMachineProvider';
import type { UIMachineSnapshot } from '@/machines/uiMachine';

/**
 * A custom hook that provides a reactive selector for the UI machine's state.
 *
 * This is the preferred way to interact with the UI machine from components.
 * It allows you to select a specific piece of state and will only re-render
 * the component when that selected value changes.
 *
 * @param selector A function that takes the machine's state and returns a selected value.
 * @param compare An optional function to compare the previous and next selected values.
 * @returns The selected value from the UI machine's state.
 */
export function useUIMachineSelector<T>(
  selector: (state: UIMachineSnapshot) => T,
  compare?: (a: T, b: T) => boolean,
): T {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUIMachineSelector must be used within a UIMachineProvider');
  }
  return useSelector(context.actorRef, selector, compare);
} 