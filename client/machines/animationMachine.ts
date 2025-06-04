import { setup } from 'xstate';

// Define event types as a discriminated union
export type AnimationEvent =
  | { type: 'TRIGGER_CARD_PLAY_ANIMATION'; payload?: { cardId: string; targetId?: string } }
  | { type: 'TRIGGER_DRAW_ANIMATION'; payload?: { count: number } }
  | { type: 'ANIMATION_COMPLETE'; animationType: string }; // e.g., 'cardPlay', 'draw'

// Define context type
export interface AnimationMachineContext {
  activeAnimations: string[]; // Store types or IDs of active animations
  // Add other context data needed for managing animations
}

export const animationMachine = setup({
  types: {
    context: {} as AnimationMachineContext,
    events: {} as AnimationEvent,
    // We can add 'actions', 'guards' types here later if we define named implementations
  },
  // We can add 'actions', 'guards', 'actors' implementations here later
}).createMachine({
  id: 'animationManager',
  initial: 'idle',
  // Context definition remains in createMachine as per initial structure and common practice
  context: {
    activeAnimations: [],
  },
  // predictableActionArguments: true, // This is for XState v4, not typically needed in v5 with setup
  states: {
    idle: {
      on: {
        TRIGGER_CARD_PLAY_ANIMATION: {
          target: 'animatingCardPlay',
          // actions: assign({ activeAnimations: (context, event) => [...context.activeAnimations, 'cardPlay:' + event.payload?.cardId] })
        },
        TRIGGER_DRAW_ANIMATION: {
          target: 'animatingDraw',
          // actions: assign({ activeAnimations: (context, event) => [...context.activeAnimations, 'draw:' + event.payload?.count] })
        },
      },
    },
    animatingCardPlay: {
      // entry: 'startCardPlayAnimationAction',
      on: {
        ANIMATION_COMPLETE: {
          target: 'idle',
          // cond now correctly infers types from setup
          cond: ({ context, event }: { context: AnimationMachineContext; event: AnimationEvent }) => 
            event.type === 'ANIMATION_COMPLETE' && event.animationType === 'cardPlay',
          // actions: assign({ activeAnimations: (context, event) => context.activeAnimations.filter(anim => anim !== 'cardPlay:' + some_id_from_event_or_context) })
        },
      },
    },
    animatingDraw: {
      // entry: 'startDrawAnimationAction',
      on: {
        ANIMATION_COMPLETE: {
          target: 'idle',
          // cond now correctly infers types from setup
          cond: ({ context, event }: { context: AnimationMachineContext; event: AnimationEvent }) => 
            event.type === 'ANIMATION_COMPLETE' && event.animationType === 'draw',
          // actions: assign({ activeAnimations: (context, event) => context.activeAnimations.filter(anim => anim !== 'draw:' + some_id_from_event_or_context) })
        },
      },
    },
  },
  // Define actions (side effects) here if needed, using the `actions` property in the config
  /*
  actions: {
    startCardPlayAnimationAction: (context, event) => {
      if (event.type === 'TRIGGER_CARD_PLAY_ANIMATION') {
        // console.log('Starting card play animation for:', event.payload?.cardId);
        // Trigger actual animation logic (e.g., Framer Motion)
      }
    },
    startDrawAnimationAction: (context, event) => {
      if (event.type === 'TRIGGER_DRAW_ANIMATION') {
        // console.log('Starting draw animation for count:', event.payload?.count);
        // Trigger actual animation logic
      }
    },
  }
  */
});

// This machine will be used with XState's React tools (e.g., useMachine or createActorContext)
// It will likely interact with the Zustand store to get game state data
// and take user input or game events as its own events to trigger animation states. 