'use client';

import { useContext } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext } from '@/components/providers/UIMachineProvider';
import type { UIMachineSnapshot } from '@/machines/uiMachine';

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