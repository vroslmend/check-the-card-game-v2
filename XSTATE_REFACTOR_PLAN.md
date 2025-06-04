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

## 3. Frontend Implementation: New Client with XState for Animations & UI

**Decision: A new frontend client will be built from scratch to fully leverage XState for animation and UI state management, ensuring a clean architecture aligned with the new backend.**

*   **Project Setup:**
    *   A new directory named `client` will be created within the existing monorepo.
    *   Technology Stack: Latest Next.js with the App Router, TypeScript, and latest Tailwind CSS (pre-configured via `create-next-app`).
*   **Design Philosophy:**
    *   The visual design, component appearance, and styling from the old frontend will be reused as templates.
    *   All underlying component logic, state management, and interaction handling will be re-implemented from the ground up.
*   **Core Goal:** Use XState to manage the states of complex animations and UI interactions, making them predictable, maintainable, and well-coordinated with Framer Motion.

### 3.1. Client-Side XState Machine(s) for UI/Animation

*   **Strategy:** A dedicated XState machine (or potentially multiple focused machines) will be created on the client to manage UI state related to animations and interactive sequences.
*   **Design Deferral:** The specific design of this machine (states, events, context, single vs. multiple machines) will be detailed after reviewing an example project provided by the user. This will help inform best practices and patterns.
*   **Purpose:** This machine will not replicate the full game logic from the server but will react to game state updates from the server and manage the visual presentation and transitions. It will be the "source of truth" for what UI components should display and how they should animate.
*   **Availability:** The machine's actor reference will likely be made available to the React component tree via a global React Context.

### 3.2. States for Animation Sequences (Conceptual - Subject to Machine Design)

*   The machine will define explicit states for different animation phases (examples from old plan, to be refined):
    *   `idle`
    *   `animatingDeckToHolding`
    *   `holdingCardPreview`
    *   `animatingHoldingToHand`
    *   `animatingHoldingToDiscard`
    *   `animatingHandToDiscard`
    // ... other relevant animation states

### 3.3. Client Machine Context (Conceptual - Subject to Machine Design)

*   The context of this client-side machine will hold data relevant to ongoing animations (examples from old plan, to be refined):
    *   `cardBeingAnimated`: { cardData: ClientCard, sourceElementId: string, targetElementId: string, layoutId: string }
    *   `activeDragSource`: { cardId: string, originalLocation: string }
    *   `currentLayoutAnimations`: Map<string, { cardId: string, from: string, to: string}>
    // ... other necessary context properties

### 3.4. Component Interaction with the Client Machine

*   React components will be designed to:
    *   Subscribe to the client-side XState machine using `useSelector` from `@xstate/react` (likely via the global context).
    *   Read animation-relevant state and context from the machine.
    *   Render `motion.div`s and `CardComponent` instances with dynamic `layoutId`, `key`, `initial`, `animate`, `exit` props based on the machine's state.
    *   Use `AnimatePresence` for enter/exit animations coordinated by the machine.
    *   Dispatch events to the client machine on user interactions (e.g., clicking "Draw from Deck" sends a `REQUEST_DRAW_FROM_DECK` event to the client machine, which then orchestrates the UI and communicates with the server if necessary).

### 3.5. Global Client-Side State Management (for `ClientCheckGameState`)

*   **Strategy Deferral:** The specific strategy for managing the main `ClientCheckGameState` (received from the server), game logs, and chat messages will be determined after reviewing the example project.
*   **Considerations:** Options include a separate XState machine for application state, other state management libraries (e.g., Zustand, Jotai), or a well-structured approach within the main Next.js page component using context. The goal is to avoid excessive prop drilling if possible.

### 3.6. Socket.IO Integration

*   Socket.IO logic (connection management, event listeners, event emitters) will be centralized, likely within a custom hook (e.g., `useSocketManager`) or a dedicated service module for clarity and reusability.

### 3.7. Benefits of New Frontend Approach

*   **Clean Slate:** Eliminates existing frontend complexity and "spaghetti code."
*   **XState-First Design:** Enables an idiomatic and robust implementation of XState for UI/animations.
*   **Improved Maintainability & Testability:** Clearer separation of concerns and declarative state management.
*   **Optimized for New Backend:** Designed from the start to work seamlessly with the XState-based server and `shared-types`.

## 4. Shared Types (`shared-types/src/index.ts`)

*   Existing types (`Card`, `PlayerState`, `ClientCheckGameState`, `PlayerActionType`, etc.) will continue to be fundamental and will be strictly adhered to in the new client.
*   **Key Enhancement**: `Card.id` will be made a mandatory `string` field to ensure stable identifiers for animations and React keys.
*   Client-side XState machine(s) will have their own specific event and context types, potentially defined within the `client` project or in `shared-types` if they need to be referenced by tests or other packages.

## 5. High-Level Step-by-Step Implementation Approach (Revised)

1.  **New Frontend Project Setup (`client` directory):**
    *   Initialize a new Next.js project using `create-next-app` (latest version, App Router, TypeScript, Tailwind CSS).
    *   Configure basic project structure, linting, etc.
2.  **Shared Types Enhancement:**
    *   Modify `Card.id` in `shared-types/src/index.ts` to be a mandatory `string`.
    *   Ensure server-side logic (`game-machine.ts` context, `generatePlayerView`) correctly assigns and manages these IDs.
3.  **Initial Frontend Structure & Planning (First Development Step):**
    *   **Discuss and define the App Router folder structure for the `client` application.** This includes outlining pages (routes), component organization (e.g., `components/ui`, `components/game`, `components/layout`), and how shared UI elements will be handled.
4.  **Socket.IO Integration Layer:**
    *   Implement the centralized Socket.IO connection management (e.g., `useSocketManager` hook or service).
    *   Establish basic connection to the server and handle core server events like `connect`, `disconnect`, and initial `GAME_STATE_UPDATE`.
5.  **Client-Side State Management & XState Machine Design (Post Example Review):**
    *   **Review example project** with the user to inform design choices.
    *   Design and implement the client-side XState machine(s) for UI/animations (`AnimationMachine`).
    *   Decide on and implement the strategy for managing global `ClientCheckGameState`, logs, and chat messages.
    *   Set up necessary React Context providers for the XState machine(s) and global state.
6.  **Core UI Component Implementation:**
    *   Re-implement fundamental UI components (`CardComponent`, `PlayerHandDisplay`, etc.), reusing visual styles from the old frontend but with new logic driven by the XState machine(s) and global state.
    *   Focus on making components "dumb" renderers that react to state.
7.  **Implement Core Game Views & Interactions:**
    *   Build out the main game board view, integrating components.
    *   Implement a key animation sequence (e.g., drawing a card) fully driven by the XState machine and Framer Motion.
    *   Wire up user actions to dispatch events to the client XState machine, which in turn may send actions to the server via the Socket.IO layer.
8.  **Iterative Development & Testing:**
    *   Incrementally implement other game features, UI states, and animations.
    *   Continuously test interactions, state transitions, and animations.
    *   Utilize `@statelyai/inspect` for debugging the client-side XState machine.
9.  **Backend Adjustments (If Necessary):**
    *   While the backend is largely complete, be prepared to make minor adjustments if the new frontend implementation reveals needs for slightly different event payloads or `ClientCheckGameState` clarifications (though the goal is to adapt the client first).

## 6. Drawing Inspiration from the Example Project (Remains Relevant)

The "Zhithead" example provides valuable patterns:

*   **`lib.ts` for Pure Game Rules:** We should strive to keep game rule logic (like card value calculations, special card effects definitions) as pure functions, separate from the XState machine when possible. The machine then uses these rules in its guards and actions. Our `cardValues` and ability logic can be structured similarly.
*   **Machine Structure (`zhitheadMachine.ts`):** The use of `setup`, typed context/events, `actions`, `guards`, `parallel` states, and `invoke`d actors are all relevant.
*   **UI Components Driven by State:** `Card.tsx`, `Hand.tsx`, `ShownHand.tsx` clearly demonstrate how UI components receive props derived from the machine's state (via selectors) and dispatch events back to the machine.
*   **`layoutId` and `AnimatePresence`:** The example's use of these Framer Motion tools, driven by the state machine, is the core pattern we want to replicate for fluid card animations.

## 7. Potential Challenges & Considerations (Revised for New Build)

*   **Initial Build Time:** Rebuilding UI components, even with existing styles, takes time.
*   **XState Design:** Crafting effective client-side XState machine(s) requires careful thought, especially for complex, interdependent animations. Reviewing the example project will be key here.
*   **Keeping Server and Client in Sync:** Ensuring the client correctly interprets `ClientCheckGameState` and that its XState machine reacts appropriately to server-driven state changes remains critical.
*   **Framer Motion Complexity:** While powerful, complex sequences with Framer Motion can still be intricate to perfect. The XState machine will help manage the "when" and "what," but the "how" of the animation details in Framer Motion still needs attention.

This revised plan sets a clear path for the new frontend development. 