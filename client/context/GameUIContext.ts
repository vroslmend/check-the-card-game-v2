'use client';

import { createActorContext } from '@xstate/react';
import { uiMachine } from '@/machines/uiMachine';
import { UIMachineSnapshot } from '@/machines/uiMachine';

export const GameUIContext = createActorContext(uiMachine);

export type { UIMachineSnapshot };