# XState Refactor Plan for "Check!" Card Game

## 1. Introduction and Goals

The "Check!" card game project has grown in complexity, particularly concerning state management for game logic on the backend and animation orchestration on the frontend. Attempts to manage intricate animation sequences (e.g., deck-to-holding-area) with multiple React `useState` hooks have led to bugs and challenging debugging sessions.

Inspired by a similar card game project that successfully utilizes XState with Framer Motion for complex animations, this document outlines a plan to refactor "Check!" using XState.

**Primary Goals:**

*   **Improve Robustness:** Make game states, transitions, and animation sequences more explicit and less error-prone.
*   **Enhance Maintainability:** Simplify the codebase by centralizing state logic, making it easier to understand, modify, and debug.
*   **Increase Clarity:** Provide a clear, visualizable model for both backend game flow and frontend animation sequences.
*   **Streamline Animation Control:** Decouple animation logic from UI components, allowing Framer Motion to be driven by a coherent state machine.
*   **Better Testability:** Enable more effective unit and integration testing of game logic and state transitions.

This refactor will target both the backend game management (`server/src/game-manager.ts`) and the frontend UI components involved in animations (`frontend/app/components/`).

## 2. Backend Refactor: `server/src/game-manager.ts`

The existing `server/src/game-manager.ts` already implements a form of state machine manually. Refactoring this to use XState will formalize its structure and leverage XState's capabilities.

### 2.1. Defining the Main Game Machine

*   A single XState machine will be created to manage the entire lifecycle of a game instance.
*   This machine will encapsulate the game's rules, phases, turns, and player interactions.

### 2.2. Mapping `ServerCheckGameState` to XState Context

*   The existing `ServerCheckGameState` interface (from `shared-types`) will serve as the primary structure for the XState machine's `context`.
*   The machine's context will hold all authoritative game data: `deck`, `players`, `discardPile`, `currentPhase`, `currentPlayerId`, etc.

### 2.3. Mapping Game Structure to XState States & Events

*   **States:**
    *   Top-level states will correspond to the existing `GamePhase` enum (e.g., `initialPeekPhase`, `playPhase`, `matchingStage`, `abilityResolutionPhase`, `finalTurnsPhase`, `scoringPhase`, `gameOver`).
    *   Nested states can be used for finer-grained control, such as `TurnSegment` within `playPhase` or `finalTurnsPhase` (e.g., `playPhase.initialAction`, `playPhase.postDrawAction`).
    *   Specific states for sub-processes like `abilityResolutionPhase.awaitingInput`, `abilityResolutionPhase.processingKing`, etc.
*   **Events:**
    *   Player actions defined in `PlayerActionType` (e.g., `DRAW_FROM_DECK`, `ATTEMPT_MATCH`) will become XState events.
    *   Internal events can be defined for timeouts or automatic transitions (e.g., `TIMER_EXPIRED`, `ALL_PLAYERS_PASSED_MATCH`).
    *   Socket.IO messages (e.g., `CREATE_GAME`, `JOIN_GAME`) will trigger events in the machine or be handled by logic that spawns/interacts with game machines.

### 2.4. Converting `handle...` Functions to XState Actions, Guards, and Services

*   **Actions (`assign`):**
    *   Logic within current functions like `handleDrawFromDeck`, `handleSwapAndDiscard`, `handleAttemptMatch` that directly modifies the game state will be refactored into XState actions using `assign` (often with Immer via `produce` for easier immutable updates).
    *   Examples:
        *   An action to move a card from `context.deck` to `context.players[playerId].pendingDrawnCard`.
        *   An action to update `context.currentPhase` or `context.currentPlayerId`.
*   **Guards:**
    *   Conditional logic (e.g., "is deck empty?", "is it player's turn?", "do cards match?") will be extracted into XState guard functions. These functions return `true` or `false` to determine if a transition should occur.
    *   Examples:
        *   `canDrawFromDeck(context, event)`
        *   `isValidMatch(context, event)`
        *   `isPlayerTurn(context, event)`
*   **Services (Invoke):**
    *   Potentially for long-running processes or interactions, though most of our game logic might fit into actions/guards. Timers are a good candidate for being invoked services or using XState's `after` (delayed transitions).

### 2.5. Managing Timers

*   XState's `after` syntax for delayed transitions can manage turn timers, peek timers, and matching stage timers.
*   Alternatively, timers can be `invoke`d as services that send events back to the machine upon expiration (e.g., `TURN_TIMEOUT`, `MATCHING_STAGE_TIMEOUT`).
*   The current `activeTurnTimerIds`, `activeDisconnectGraceTimerIds`, `activeMatchingStageTimer` maps will be replaced by XState's internal timer management.
    *   The logic in `handleTurnTimeout`, `handleDisconnectTimeout`, `handleMatchingStageTimeout` will be refactored into transitions triggered by these timer events.

### 2.6. Integration with Socket.IO (`server/src/index.ts`)

*   `server/src/index.ts` will manage instances of the game machine (one per active game room).
*   When a player action is received via Socket.IO, `index.ts` will retrieve the appropriate game machine instance and `send` the corresponding event to it.
*   The machine's state changes (updated context) will then be used to `generatePlayerView` and broadcast to clients via Socket.IO, similar to the current `broadcastGameStateCustom` and `broadcastLogEntryCustom` mechanisms.

### 2.7. Benefits for Backend

*   **Visualizable Logic:** Game flow can be visualized using Stately Inspector.
*   **Reduced Boilerplate:** Less manual state checking and transition logic.
*   **Predictable State:** The game can only be in defined states with defined transitions.
*   **Easier Debugging:** Tracing event sequences and state changes becomes simpler.

## 3. Frontend Refactor: Animation and UI State

The primary goal on the frontend is to use XState to manage the states of complex animations and UI interactions, making them more predictable and easier to coordinate with Framer Motion.

### 3.1. Client-Side Animation Machine(s)

*   A dedicated XState machine (or potentially multiple focused machines) will be created on the client to manage UI state related to animations and interactive sequences.
*   This machine will not replicate the full game logic from the server but will react to game state updates from the server and manage the visual presentation and transitions.
*   It will be the "source of truth" for what UI components should display and how they should animate.

### 3.2. States for Animation Sequences

*   The machine will define explicit states for different animation phases:
    *   `idle`
    *   `animatingDeckToHolding`
    *   `holdingCardPreview` (player deciding what to do with drawn card)
    *   `animatingHoldingToHand`
    *   `animatingHoldingToDiscard`
    *   `animatingHandToDiscard`
    *   `animatingCardBetweenPiles` (e.g., during a match resolution)
    *   `animatingPlayerHandDeal`
    *   `initialCardPeekActive`

### 3.3. Client Machine Context

*   The context of this client-side machine will hold data relevant to ongoing animations:
    *   `cardBeingAnimatedOutFromDeck`: { card: Card, layoutId: string }
    *   `cardInHoldingArea`: { card: Card | null, source: 'deck' | 'discard', layoutId: string }
    *   `cardMovingToHand`: { card: Card, layoutId: string }
    *   `activeDragSource`: { cardId: string, originalLocation: string } (if implementing drag-and-drop later)
    *   `layoutIdForDeckDrawAnimation`: string (e.g., `deck-to-holding-anim-${cardId}`)
    *   `layoutIdForHoldingSlot`: string

### 3.4. Component Interaction with the Client Machine

*   React components (`CheckGameBoard.tsx`, `DrawPileComponent.tsx`, `HoldingAreaComponent.tsx`, `PlayerHandComponent.tsx`, `CardComponent.tsx`, `DiscardPileComponent.tsx`) will:
    *   Subscribe to the client-side XState machine using `useSelector` from `@xstate/react` (via a context provider similar to the example's `GlobalStateContext`).
    *   Read animation-relevant state and context from the machine.
    *   Render `motion.div`s and `CardComponent` instances with dynamic `layoutId`, `key`, `initial`, `animate`, `exit` props based on the machine's state.
    *   Use `AnimatePresence` for enter/exit animations coordinated by the machine.
    *   Dispatch events to the client machine on user interactions (e.g., clicking "Draw from Deck" sends a `REQUEST_DRAW_FROM_DECK` event to the client machine, which might then communicate with the server).
*   **Example Flow (Deck to Holding):**
    1.  User clicks "Draw from Deck".
    2.  `ActionButton` sends `ATTEMPT_DRAW_DECK` to client animation machine.
    3.  Client machine transitions to `awaitingServerConfirmationForDeckDraw`. It sends `PLAYER_ACTION ({ type: DRAW_FROM_DECK })` to the server.
    4.  Server processes, its XState machine updates, broadcasts new `ClientCheckGameState`.
    5.  Client receives `GAME_STATE_UPDATE`.
    6.  Client's main logic updates its representation of the game state. The client animation machine is also notified (or infers from game state change).
    7.  If draw was successful (e.g., `pendingDrawnCard` is now populated on client state), client animation machine transitions to `animatingDeckToHolding`.
        *   Context: `cardBeingAnimatedOutFromDeck` gets the drawn card details, `layoutIdForDeckDrawAnimation` is set.
    8.  `DrawPileComponent` renders a `motion.div` for the card with `layoutId={machine.context.layoutIdForDeckDrawAnimation}` and `exit` animation.
    9.  `HoldingAreaComponent` renders a `motion.div` for the slot with `layoutId={machine.context.layoutIdForDeckDrawAnimation}`.
    10. Framer Motion animates the card from deck to holding.
    11. On animation complete (can be handled by Framer Motion's `onAnimationComplete` or an XState `after` delay), client machine transitions to `holdingCardPreview`.

### 3.5. Decoupling from Server State for Animation Details

*   The client animation machine will often listen to broader game state changes from the server (e.g., "a card was drawn and is now in `pendingDrawnCard`") and then manage the fine-grained, multi-step animation itself, rather than expecting the server to dictate every frame or micro-state of an animation.

### 3.6. Benefits for Frontend

*   **Simplified Components:** React components become "dumber" and primarily focus on rendering based on the animation machine's state.
*   **Centralized Animation Logic:** All animation orchestration logic moves into the XState machine.
*   **Reduced Bugs:** Eliminates race conditions and inconsistent states that arise from scattered `useState` and `useEffect` for animations.
*   **Testable Animations:** Animation sequences can be tested by sending events to the client machine and asserting its state/context.

## 4. Shared Types (`shared-types/src/index.ts`)

*   Existing types (`Card`, `PlayerState`, `ClientCheckGameState`, `PlayerActionType`, `GamePhase`, etc.) will continue to be fundamental.
*   **New Types for XState:**
    *   We might define specific event types for the client-side animation machine (e.g., `ANIMATION_START.DECK_TO_HOLDING`, `ANIMATION_COMPLETE.DECK_TO_HOLDING`).
    *   Context types for the client-side animation machine will be needed.

## 5. High-Level Step-by-Step Refactor Approach

1.  **Setup XState & Tooling:**
    *   Install `xstate` and `@xstate/react`.
    *   Set up `@statelyai/inspect` for visual debugging on both backend (if possible in Node environment, or via client-side simulation) and frontend.
2.  **Backend Refactor - Phase 1 (Machine Definition):**
    *   Define the core XState machine structure for `game-manager.ts` (`GameMachine`).
    *   Map `GamePhase` to states and `PlayerActionType` to events.
    *   Define the machine's `context` using `ServerCheckGameState`.
    *   Start migrating simple `handle...` functions into actions and guards.
    *   Focus on one or two core game flows initially (e.g., drawing, discarding).
3.  **Backend Refactor - Phase 2 (Integration & Testing):**
    *   Integrate the `GameMachine` into `server/src/index.ts` to manage game instances.
    *   Adapt Socket.IO event handlers to `send` events to the machine and use its updated state.
    *   Write unit tests for the machine's transitions, actions, and guards.
    *   Thoroughly test game flows with the new XState backend.
4.  **Frontend Refactor - Phase 1 (Animation Machine Definition):**
    *   Design the client-side XState machine (`AnimationMachine`) for orchestrating UI animations.
    *   Define its states, events, and context related to animation sequences.
    *   Set up the `GlobalStateContext` (or a similar named context) for this machine in the frontend.
5.  **Frontend Refactor - Phase 2 (Component Integration):**
    *   Start with one complex animation sequence (e.g., deck-to-holding).
    *   Refactor the relevant components (`CheckGameBoard`, `DrawPileComponent`, `HoldingAreaComponent`) to be driven by the `AnimationMachine`.
    *   Ensure `layoutId`s are correctly managed by the machine's state and consumed by components.
    *   Gradually refactor other animated interactions.
6.  **End-to-End Testing:**
    *   Perform comprehensive testing of the full game loop with the refactored backend and frontend.

## 6. Drawing Inspiration from the Example Project

The "Zhithead" example provides valuable patterns:

*   **`lib.ts` for Pure Game Rules:** We should strive to keep game rule logic (like card value calculations, special card effects definitions) as pure functions, separate from the XState machine when possible. The machine then uses these rules in its guards and actions. Our `cardValues` and ability logic can be structured similarly.
*   **Machine Structure (`zhitheadMachine.ts`):** The use of `setup`, typed context/events, `actions`, `guards`, `parallel` states, and `invoke`d actors are all relevant.
*   **UI Components Driven by State:** `Card.tsx`, `Hand.tsx`, `ShownHand.tsx` clearly demonstrate how UI components receive props derived from the machine's state (via selectors) and dispatch events back to the machine.
*   **`layoutId` and `AnimatePresence`:** The example's use of these Framer Motion tools, driven by the state machine, is the core pattern we want to replicate for fluid card animations.

## 7. Potential Challenges & Considerations

*   **Learning Curve:** If the team is new to XState, there will be an initial learning period.
*   **Refactoring Effort:** This is a significant refactor and will take time.
*   **Debugging:** While Stately Inspector is excellent, debugging complex state machines can still be challenging initially.
*   **Backend vs. Frontend Machine Boundary:** Clearly defining the responsibilities between the server's game logic machine and the client's animation machine will be important to avoid overlap or gaps. The client machine should primarily react to server state and manage presentation, not re-implement game rules.

## 8. Conclusion

Refactoring "Check!" to use XState is a strategic investment. It promises to resolve current complexities in state management and animation, leading to a more robust, maintainable, and understandable codebase. The patterns observed in the example project provide a strong foundation and a clear path forward for successfully implementing this powerful state management paradigm. 