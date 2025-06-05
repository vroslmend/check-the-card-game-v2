# Architecture Overview

This document describes the high-level architecture of the Check! card game project. It covers the main components, their responsibilities, and how they interact.

## 1. Core Philosophy

The core architectural philosophy for "Check!" centers around creating a seamless and robust multiplayer card game experience. Key goals include:
*   **Real-time Multiplayer Interaction:** Ensuring that all players experience game events and state changes simultaneously and smoothly.
*   **Authoritative Server:** Maintaining a single source of truth for game state and rules on the server using XState to prevent inconsistencies and cheating.
*   **Robust State Management:** Utilizing clear and predictable state management patterns:
    *   **Server-side:** XState (`server/src/game-machine.ts`) for all game logic and authoritative state.
    *   **Client-side:** Zustand (`client/store/gameStore.ts`) for storing server-pushed game data, and XState (`client/machines/uiMachine.ts`) for orchestrating UI interactions, local UI state, and complex user flows.
*   **Engaging User Experience:** Leveraging Next.js (App Router), TypeScript, and Tailwind CSS to create an intuitive and visually appealing interface. Framer Motion is planned for animations.

## 2. System Components

The project is structured as a monorepo using npm workspaces, comprising three main packages: `client`, `server`, and `shared-types`.

*   ### 2.1. Frontend (Client)
    *   **Technology:** Next.js (App Router), TypeScript, Tailwind CSS, XState, Zustand.
    *   **Responsibilities:**
        *   Rendering the game interface (lobby, game board, cards, player hands, actions).
        *   Handling user input and interactions.
        *   Managing local UI state, interaction flows (e.g., multi-step abilities, selections), and animation cues via the `uiMachine`.
        *   Storing and displaying core game data (`ClientCheckGameState`, logs, chat) received from the server in a Zustand store (`gameStore`).
        *   Managing the Socket.IO connection lifecycle and processing incoming server events via `SocketContext`.
        *   Sending player actions and other client-originated events to the server via the `uiMachine` (which uses `SocketContext`'s `emitEvent` indirectly via `UIMachineProvider`).
    *   **Key Directories/Modules:**
        *   `client/app/layout.tsx`: Root application layout, integrates global providers like `SocketProvider` and `UIMachineProvider`.
        *   `client/app/page.tsx`: The main landing page, serving as a **Lobby** for users to input their name and create or join games. It initializes `localPlayerId` in the `gameStore`.
        *   `client/app/(game)/[gameId]/page.tsx`: The primary page for rendering the active game session for a specific `gameId`. It orchestrates various game components and interacts heavily with `gameStore` and `uiMachine`.
        *   `client/components/`:
            *   `game/`: Game-specific React components (e.g., `PlayerHand.tsx`, `GameBoardArea.tsx`).
            *   `ui/`: General UI elements (e.g., `CardDisplay.tsx`, buttons, modals from `shadcn/ui`).
            *   `layout/`: Layout-specific components.
        *   `client/context/SocketContext.tsx`:
            *   Instantiates and manages `useSocketManager`.
            *   Handles the Socket.IO connection lifecycle (connect/disconnect).
            *   Registers listeners for all relevant server-sent events (e.g., `GAME_STATE_UPDATE`, `SERVER_LOG_ENTRY`, `CHAT_MESSAGE`, `INITIAL_LOGS`, `serverError`, `PLAYER_JOINED`, `REJOIN_DENIED`, `RESPOND_CARD_DETAILS_FOR_ABILITY`).
            *   Updates `gameStore` (Zustand) and/or sends events to `uiMachine` based on received server messages.
            *   Provides the `socket` instance, `emitEvent` function (used by `UIMachineProvider` and potentially other direct emitters like chat), and `isConnected` status to the rest of the application via the `useSocket` hook.
        *   `client/hooks/`:
            *   `useSocketManager.ts`: Low-level management of the Socket.IO client instance (connection, disconnection, basic event emission and listener registration primitives).
            *   `usePlayerInput.ts`: A utility hook that takes the `socket` instance (from `SocketContext`) and `localPlayerId` (from `gameStore`) to provide specific, callable functions (e.g., `sendDrawFromDeckAction`, `sendResolveSpecialAbilityAction`) for emitting `PlayerActionType` events to the server. It is primarily used by the `uiMachine` (via `UIMachineProvider`) when the machine determines a game action needs to be sent.
            *   `useGameEvents.ts`: Appears to be a legacy or redundant hook, as its primary function (listening to server events and updating `gameStore`) is now directly handled within `client/context/SocketContext.tsx`.
        *   `client/machines/uiMachine.ts`: Defines the client-side XState machine (`uiMachine`) that orchestrates all UI logic, user interaction flows (e.g., drawing cards, initial peek, multi-step abilities like King/Queen/Jack), manages temporary UI-specific state (e.g., selected cards, ability progress), and triggers server communication by emitting `EMIT_TO_SOCKET` events. It may use `localPlayerId` from `gameStore` (via props/context from `UIMachineProvider`) to correctly attribute actions.
        *   `client/machines/uiMachineProvider.tsx`: Provides the `uiMachine` actor instance to the component tree. It listens for `EMIT_TO_SOCKET` events from the `uiMachine` and uses the `emitEvent` function (obtained from `SocketContext`) to send these actions to the server. It also passes necessary context like `localPlayerId` and `gameId` to the `uiMachine`.
        *   `client/store/gameStore.ts`: Zustand store setup. It holds the `ClientCheckGameState`, `localPlayerId`, game logs (`RichGameLogMessage[]`), and chat messages (`ChatMessage[]`). It's updated primarily by event handlers within `client/context/SocketContext.tsx`.
        *   `client/lib/`: Client-side utilities, constants, and client-specific types.
        *   `client/styles/globals.css`: Global styles, including Tailwind CSS base styles.

*   ### 2.2. Backend (Server)
    *   **Technology:** Node.js, Express (for HTTP server, though not serving HTML), Socket.IO, TypeScript, XState.
    *   **Responsibilities:**
        *   Managing all client connections via Socket.IO.
        *   Instantiating, managing, and destroying XState game machine actors (`gameMachine`) for each active game. When a `gameMachine` reaches its final state (e.g., `gameOver`), its reference is removed from the active pool.
        *   Routing incoming socket events from clients (e.g., `PLAYER_ACTION`, `CREATE_GAME`) to the appropriate `gameMachine` actor instance.
        *   Subscribing to emissions from `gameMachine` actors (e.g., state updates, log entries, errors).
        *   Broadcasting game state updates (`ClientCheckGameState`), log messages (`RichGameLogMessage`), and other relevant information to clients based on `gameMachine` emissions, using `generatePlayerView` to tailor state for each client.
        *   Enforcing all game logic and rules via the `gameMachine`.
    *   **Key Files/Modules:**
        *   `server/src/index.ts`:
            *   Main server entry point. Initializes the HTTP server and Socket.IO server.
            *   Manages a map of active `gameMachine` actor references (`activeGameMachines`). Handles cleanup of actors when their machines terminate.
            *   Handles new client connections: registers socket sessions (`socketSessionMap`), manages basic event routing like `CREATE_GAME`, `JOIN_GAME`, `ATTEMPT_REJOIN`, `PLAYER_ACTION`, `SEND_CHAT_MESSAGE`, `REQUEST_CARD_DETAILS_FOR_ABILITY`.
            *   For `CREATE_GAME`: Creates a new `gameMachine` actor, stores its reference, sends `PLAYER_JOIN_REQUEST` to the new machine. The machine's subsequent emissions (e.g., initial `BROADCAST_GAME_STATE`) are then used to inform the creator.
            *   For `JOIN_GAME`/`ATTEMPT_REJOIN`: Validates game ID, associates player with an existing `gameMachine` actor, and uses machine emissions to send current state.
            *   For `PLAYER_ACTION`: Forwards the action event to the corresponding `gameMachine` actor.
            *   Handles `disconnect` events: Sends `PLAYER_DISCONNECTED` to the relevant `gameMachine` and cleans up the socket session.
            *   Subscribes to emissions from each `gameMachine` actor:
                *   `BROADCAST_GAME_STATE`: For each connected player in the game, calls `generatePlayerView` (from `game-manager.ts`) to get their specific view of the `GameMachineContext` and emits `GAME_STATE_UPDATE` to that player.
                *   `EMIT_LOG_PUBLIC`/`EMIT_LOG_PRIVATE`: Constructs `RichGameLogMessage` and emits `SERVER_LOG_ENTRY` to appropriate clients.
                *   `BROADCAST_PLAYER_SPECIFIC_STATE`: Emits a tailored `GAME_STATE_UPDATE` to a single player (e.g., for King/Queen peek reveals).
                *   `EMIT_ERROR_TO_CLIENT`: Sends an error message to a specific client or all in a game.
        *   `server/src/game-machine.ts`:
            *   The definitive source of truth for all game rules, state transitions, and player action validation.
            *   Implemented as an XState state machine. This manages game phases (`awaitingPlayers`, `initialPeek`, `playerTurn`, `matchingStage`, etc.), player turns, pending abilities, and game-over conditions.
            *   It is pure logic; it does not directly interact with sockets. Instead, it processes events and emits `GameMachineEmittedEvents` that `server/src/index.ts` uses to communicate with clients.
        *   `server/src/game-manager.ts`:
            *   **Primary active role:** Provides the `generatePlayerView` utility function. This function takes the full `ServerCheckGameState` (from the `gameMachine`'s context) and a `viewingPlayerId`, returning a `ClientCheckGameState` with sensitive information redacted (e.g., other players' hidden cards are represented as `HiddenCard`).
            *   Previously, this file contained extensive legacy game logic handlers, phase management, and timer systems. These have been removed as the XState `gameMachine` (`server/src/game-machine.ts`) is now the sole authority for game logic.
        *   `server/src/lib/deck-utils.ts`:
            *   A utility file containing pure, stateless functions related to game setup.
            *   Currently holds `createDeckWithIds` (to generate a standard 52-card deck with unique IDs) and `shuffleDeck` (to randomize the deck order).
            *   These functions were refactored out of `game-machine.ts` to improve separation of concerns.

*   ### 2.3. Shared Logic (`shared-types/`)
    *   **Technology:** TypeScript.
    *   **Responsibilities:** Provides a single source of truth for all data structures, type definitions (interfaces), enumerations (`SocketEventName`, `PlayerActionType`, `GamePhase`, `Rank`, `Suit`, etc.), and communication contracts used by both the `client` and `server`. This is crucial for type safety and consistent data handling across the monorepo.
    *   **Key Files/Modules:**
        *   `shared-types/src/index.ts`: Contains all shared type definitions. This includes:
            *   Core game elements: `PlayerId`, `Card` (with `id`), `Suit`, `Rank`, `cardValues`.
            *   Player state: `PlayerState` (server-side full state), `ClientPlayerState` (client-side redacted view), `HiddenCard`, `ClientCard`.
            *   Game state: `ServerCheckGameState` (full state on server, used as base for `GameMachineContext`), `ClientCheckGameState` (redacted state for client).
            *   Game phases and segments: `GamePhase`, `TurnSegment`, `PlayerActivityStatus`.
            *   Communication contracts: `SocketEventName`, `PlayerActionType`, `InitialPlayerSetupData`.
            *   Ability-related types: `SpecialAbilityInfo`, `AbilityArgs`, `PendingSpecialAbility`.
            *   Game outcome: `GameOverData`, `ClientGameOverData`, `MatchResolvedDetails`.
            *   Logging & Chat: `RichGameLogMessage`, `ChatMessage`.
            *   XState machine specific types: `GameMachineContext` (the machine's internal state), `GameMachineInput` (for machine creation), `GameMachineEvent` (all events the machine can process, forming its input contract), `GameMachineEmittedEvents` (all events the machine can emit, forming its output contract).
            *   Payloads for specific socket events: `RequestCardDetailsPayload`, `RespondCardDetailsPayload`.
    *   **Game State Broadcasting & Utilities (`server/src/game-manager.ts`):**
        *   **Player View Generation:** Its most critical current function is `generatePlayerView`. When `server/src/index.ts` receives a `BROADCAST_GAME_STATE` emission from a `gameMachine`, it calls `generatePlayerView(machine.getContext(), viewingPlayerId)`. This function takes the full server-side game state and a specific player's ID, returning a `ClientCheckGameState` tailored for that player (e.g., redacting other players' hidden cards, showing only deck size instead of full deck). This ensures players only see what they're supposed to.
        *   **Legacy Logic:** `game-manager.ts` previously contained many other helper functions related to game mechanics, direct game state manipulations, and a separate timer system. This legacy code has been removed. The XState `gameMachine` (`server/src/game-machine.ts`) now encapsulates all game mechanics directly, using its own actions, guards, and actor-based timers.

## 3. High-Level System Flow and Interaction

This section provides a bird's-eye view of how the major architectural pieces of the "Check!" game work together.

*   **Monorepo Structure:** The project is divided into three main packages:
    *   `shared-types/`: The bedrock of communication. It defines all TypeScript types, enums, and interfaces used by both the client and server. This ensures that data structures (like cards, player states, game states, event payloads) are consistent across the entire application, preventing mismatches and errors.
    *   `server/`: The authoritative backend. Its primary responsibilities include managing game instances, enforcing game rules, and facilitating real-time communication.
    *   `client/`: The frontend interface. It's responsible for rendering the game for the user, capturing player inputs, and reflecting game state changes.

*   **Core Server Operations (`server/`):**
    *   **Socket.IO Hub (`server/src/index.ts`):** This is the entry point for all client connections. It handles establishing and managing Socket.IO sessions. When clients send events (like creating a game, joining, or performing a player action), `server/src/index.ts` receives them.
    *   **Game Logic Authority (`server/src/game-machine.ts`):** For each active game, an XState machine instance (the `gameMachine`) is spawned. This machine is the *single source of truth* for all game logic, rules, states, and transitions. It receives game-related events forwarded by `server/src/index.ts`, processes them according to its defined logic, updates its internal game state (`GameMachineContext`), and emits events to signal changes.
    *   **Game State Broadcasting:** When the `gameMachine` emits an event indicating a state change (e.g., `BROADCAST_GAME_STATE`), `server/src/index.ts` takes over. It uses the `generatePlayerView` function from `server/src/game-manager.ts` to create a tailored, redacted version of the game state (`ClientCheckGameState`) for each player (hiding other players' hands, etc.). This player-specific state is then broadcasted to the relevant clients via Socket.IO.
    *   **`server/src/game-manager.ts`:** While `game-machine.ts` is the core logic engine, `game-manager.ts` provides utility functions. Its most critical current role is `generatePlayerView`. Other functions within it are largely legacy as the XState machine now encapsulates most game mechanics directly.

*   **Client-Side Architecture (`client/`):**
    *   **User Interface (React Components):** Built with Next.js and React, components in `client/components/` render the game board, player hands, lobby, etc. They display data from client-side state stores and capture user interactions.
    *   **Socket Communication (`client/context/SocketContext.tsx`):** This context is central to client-server communication. It initializes and manages the Socket.IO connection using `useSocketManager`. It listens for all server-sent events (like `GAME_STATE_UPDATE`, `SERVER_LOG_ENTRY`). When events are received, `SocketContext` updates the client-side state (primarily the `gameStore`) and can also send events to the `uiMachine` if the update requires a specific UI reaction. It also provides an `emitEvent` function for sending messages to the server.
    *   **UI Orchestration (`client/machines/uiMachine.ts`):** This XState machine manages complex UI flows, user interactions, and transient UI-specific states (e.g., selecting cards for an ability, managing modal visibility). When a user performs an action (e.g., clicks "Draw Card"), the UI component sends an event to the `uiMachine`. The `uiMachine` processes this, potentially updates its own state, and if a server action is required, it emits an `EMIT_TO_SOCKET` event.
    *   **Sending Actions to Server (`client/machines/uiMachineProvider.tsx`):** This provider hosts the `uiMachine` actor. It listens for `EMIT_TO_SOCKET` events from the `uiMachine`. Upon receiving such an event, it uses the `emitEvent` function from `SocketContext` (which might internally use `usePlayerInput` for specific action formatting) to send the relevant player action and payload to the server.
    *   **Client-Side Game Data (`client/store/gameStore.ts`):** This Zustand store holds the client's view of the game state (`ClientCheckGameState`), `localPlayerId`, game logs, and chat messages. It's primarily updated by `SocketContext` when new data arrives from the server. React components subscribe to this store to re-render when data changes.

*   **Typical Interaction Flow (Example: Player Drawing a Card):**
    1.  **User Input:** Player clicks the "Draw Card" button in the client UI.
    2.  **UI Machine:** The React component sends an event (e.g., `DRAW_BUTTON_CLICKED`) to the `uiMachine`.
    3.  **Action Emission:** The `uiMachine` processes this, determines a `DRAW_FROM_DECK` action needs to be sent to the server, and emits `EMIT_TO_SOCKET` with the necessary payload.
    4.  **Socket Transmission (Client):** `UIMachineProvider` catches `EMIT_TO_SOCKET` and uses `SocketContext.emitEvent` to send a `PLAYER_ACTION` (with `PlayerActionType.DRAW_FROM_DECK`) over WebSockets to the server.
    5.  **Server Reception:** `server/src/index.ts` receives the `PLAYER_ACTION`.
    6.  **Game Logic Processing:** `server/src/index.ts` forwards the action as an event to the appropriate `gameMachine` instance.
    7.  **State Update & Emission:** The `gameMachine` validates and executes the draw action, updates its `GameMachineContext` (moves a card from deck to player's pending), and emits events like `BROADCAST_GAME_STATE` and log events.
    8.  **Broadcast Preparation:** `server/src/index.ts` receives these emissions. For `BROADCAST_GAME_STATE`, it calls `generatePlayerView` for each player in the game.
    9.  **Socket Transmission (Server):** `server/src/index.ts` sends `GAME_STATE_UPDATE` (with the tailored `ClientCheckGameState`) and `SERVER_LOG_ENTRY` events to the connected clients.
    10. **Client Reception & State Update:** `client/context/SocketContext.tsx` on each client receives these events. It updates the `gameStore` with the new game state and logs.
    11. **UI Re-render:** React components subscribed to `gameStore` (and potentially `uiMachine` if it also changed state) re-render to reflect the drawn card and new game log entries.

This interconnected system ensures that the server remains the authority on game state, while the client provides a responsive and interactive user experience, with `shared-types` ensuring both sides speak the same language.

## 4. State Management Strategy

*   **3.1. Server-Side (Authoritative Game State):**
    *   **XState (`server/src/game-machine.ts`):** The `gameMachine` is the **sole and definitive source of truth** for all game rules, states, valid transitions, and actions that execute game logic.
    *   The machine's `context` (`GameMachineContext`) holds the complete `ServerCheckGameState`, including `gameId`, `deck`, `discardPile`, `players` map (with `PlayerState`), `currentPhase`, `currentPlayerId`, `turnOrder`, `pendingAbilities`, `logHistory`, etc.
    *   Client actions (received by `server/src/index.ts` via Socket.IO) are translated into `GameMachineEvent`s and sent to the corresponding `gameMachine` actor instance.
    *   The `gameMachine` processes these events, updates its context immutably (via XState's `assign`), and triggers `GameMachineEmittedEvents` (side effects) that are handled by `server/src/index.ts` to communicate changes back to clients.

*   **3.2. Client-Side (UI State, Local Data Cache, Interaction Orchestration):**
    *   A combination of Zustand and XState is used.
    *   **Zustand (`client/store/gameStore.ts`):**
        *   Serves as a reactive store for global client-side data that is primarily pushed by the server.
        *   Stores: `ClientCheckGameState`, `localPlayerId`, `RichGameLogMessage[]`, `ChatMessage[]`.
        *   **Updates:** Primarily updated by event listeners in `client/context/SocketContext.tsx` upon receiving server events.
    *   **XState (`client/machines/uiMachine.ts`):**
        *   Orchestrates UI logic, user interaction flows, and manages temporary UI-specific state.
        *   **Responsibilities:** Managing UI states (e.g., `initializing`, `idle`, `playerAction.promptPendingCardDecision`, `abilityActive.promptingSelection`), handling UI events, translating them into `EMIT_TO_SOCKET` events for server communication, managing transient UI data (`selectedHandCardIndex`, `abilityContext`), controlling modals/toasts. It uses `localPlayerId` from `gameStore` (via props/context from `UIMachineProvider`) to correctly attribute actions.
        *   **Server Communication (Sending):** `uiMachine` emits `EMIT_TO_SOCKET` -> `UIMachineProvider` uses `SocketContext.emitEvent` (which itself might use `usePlayerInput` or directly call `socket.emit`).
        *   **Server Communication (Receiving):** `SocketContext` receives server events -> updates `gameStore` and/or sends events to `uiMachine` for UI-specific reactions.

    *   **Interaction Model:**
        1.  **Data Display:** UI Components subscribe to `gameStore` (Zustand) and `uiMachine` (XState selectors).
        2.  **User Actions:** UI interactions send events to `uiMachine`.
        3.  **Client-Side Logic:** `uiMachine` processes events, updates its context.
        4.  **Sending to Server:** `uiMachine` emits `EMIT_TO_SOCKET` -> `UIMachineProvider` -> `SocketContext.emitEvent`.
        5.  **Receiving from Server:** `SocketContext` listens -> updates `gameStore` and/or sends event to `uiMachine`.
        6.  **UI Re-render:** Components re-render based on `gameStore` and `uiMachine` state changes.

## 5. Real-Time Communication

*   **Protocol:** WebSockets
*   **Library:** Socket.IO
*   **Flow (Simplified Server-Centric View):**
    1.  **Client Connection:** Client connects to Socket.IO server (`server/src/index.ts`). A socket session is established.
    2.  **Game Creation/Joining:**
        *   Client sends `SocketEventName.CREATE_GAME` or `SocketEventName.JOIN_GAME` with `InitialPlayerSetupData`.
        *   `server/src/index.ts` handles this:
            *   For `CREATE_GAME`: Creates a new `gameMachine` actor, stores its reference, sends `PLAYER_JOIN_REQUEST` to the new machine.
            *   For `JOIN_GAME`: Finds existing `gameMachine` actor, sends `PLAYER_JOIN_REQUEST` to it.
        *   The `gameMachine` processes `PLAYER_JOIN_REQUEST` (in `awaitingPlayers` state): updates its context (deals cards, adds player to `turnOrder`), emits `BROADCAST_GAME_STATE`.
        *   `server/src/index.ts` receives `BROADCAST_GAME_STATE`, generates player-specific views using `generatePlayerView`, and sends `GAME_STATE_UPDATE` to clients.
    3.  **Client Action (e.g., Player Draws a Card):**
        *   Client UI (`uiMachine` -> `SocketContext`) sends `SocketEventName.PLAYER_ACTION` with `PlayerActionType.DRAW_FROM_DECK` and payload (`{ playerId }`).
        *   `server/src/index.ts` receives this and sends the event (e.g., `{ type: 'DRAW_FROM_DECK', playerId: '...' }`) to the correct `gameMachine` actor.
    4.  **Server Game Logic Processing (`gameMachine`):**
        *   `gameMachine` receives the `DRAW_FROM_DECK` event.
        *   It validates the action (guards like `isPlayersTurn`, `deckIsNotEmpty`).
        *   If valid, it executes actions: takes a card from `context.deck`, adds it to `context.players[playerId].pendingDrawnCard`, updates `context.deck`.
        *   It transitions to a new state (e.g., `playPhase.playerTurn.awaitingPostDrawAction`).
        *   It emits `EMIT_LOG_PUBLIC` (player drew) and `EMIT_LOG_PRIVATE` (you drew X card) events, and a `BROADCAST_GAME_STATE` event.
    5.  **Server Broadcast (`server/src/index.ts`):**
        *   Receives `EMIT_LOG_PUBLIC`/`EMIT_LOG_PRIVATE`: Sends `SERVER_LOG_ENTRY` to relevant clients.
        *   Receives `BROADCAST_GAME_STATE`: For each player in that game, calls `generatePlayerView(machine.getContext(), viewingPlayerId)` and sends the resulting `ClientCheckGameState` via `GAME_STATE_UPDATE`.
    6.  **Client Receives Update:**
        *   `SocketContext` listener for `GAME_STATE_UPDATE` updates `gameStore`.
        *   `SocketContext` listener for `SERVER_LOG_ENTRY` updates `gameStore` (log history) and may inform `uiMachine`.
        *   UI components re-render.

## 6. Key Data Structures

The integrity and consistency of the game rely on well-defined data structures in `shared-types/src/index.ts`.
*   **`Card`**: `{ suit: Suit, rank: Rank, id: string }`. `id` is crucial.
*   **`PlayerState` (Server)**: Holds full player data: `hand: Card[]` (with `isFaceDownToOwner` flags), `score`, `name`, `isConnected`, `socketId`, `hasCalledCheck`, `isLocked`, `pendingDrawnCard`, `pendingSpecialAbility`, etc.
*   **`ClientPlayerState`**: Redacted view for clients, `hand: ClientCard[]` (where `ClientCard` can be `Card` or `HiddenCard`).
*   **`ServerCheckGameState`**: Authoritative server state: `deck: Card[]`, `discardPile: Card[]`, `players: { [playerID: string]: PlayerState }`, `currentPhase: GamePhase`, `currentPlayerId`, `turnOrder`, `pendingAbilities: PendingSpecialAbility[]`, `matchingOpportunityInfo`, `gameMasterId`, `logHistory`, `gameover: GameOverData | null`, etc.
*   **`ClientCheckGameState`**: Redacted for client: `deckSize: number`, `players: { [playerID: string]: ClientPlayerState }`, `viewingPlayerId`, etc.
*   **`GameMachineContext`**: Extends `ServerCheckGameState`, adding `gameId`. This is the context object of the `server/src/game-machine.ts`.
*   **`GameMachineEvent`**: Union of all possible events the `gameMachine` can process, including `ConcretePlayerActionEvents` (derived from `PlayerActionType` like `DRAW_FROM_DECK`, `ATTEMPT_MATCH`) and internal events like `PEEK_TIMER_EXPIRED`, `PLAYER_DISCONNECTED`. These define the machine's input contract.
*   **`GameMachineEmittedEvents`**: Union of events the `gameMachine` can emit for `server/src/index.ts` to act upon, like `BROADCAST_GAME_STATE`, `EMIT_LOG_PUBLIC`, `EMIT_LOG_PRIVATE`, `EMIT_ERROR_TO_CLIENT`. These define the machine's output contract.
*   `SocketEventName`: Enums for all client-server socket event names.
*   `PlayerActionType`: Enums for all player actions sent within the `PLAYER_ACTION` socket event.
*   `RichGameLogMessage`, `ChatMessage`: For structured logging and chat.

## 7. Error Handling Strategy

*   **Server-Side:** The `gameMachine` can identify invalid actions or inconsistent states. When an error occurs that needs client notification, it emits an `EMIT_ERROR_TO_CLIENT` event, often including a `playerId` if the error is specific, and a descriptive `message`.
*   **Server `index.ts`:** Listens for `EMIT_ERROR_TO_CLIENT` from the game machine and relays the error information to the specified client(s) using the `SocketEventName.ERROR_MESSAGE` (or a general purpose server message).
*   **Client-Side:** `SocketContext.tsx` listens for `SocketEventName.ERROR_MESSAGE` (or `SocketEventName.serverError`). Upon receipt, it can:
    *   Add the error to the `gameStore`'s log for general visibility.
    *   Send an event to the `uiMachine` (e.g., `SERVER_ERROR_RECEIVED`) which can then transition to an error state or trigger UI feedback like a toast notification or modal to inform the user directly.

## 8. Project Setup and Running

The project is a monorepo managed with npm workspaces. Key scripts are defined in the root `package.json`:
*   `npm install`: Installs dependencies for all workspaces.
*   `npm run build`: Builds all packages (`shared-types` -> `server` -> `client`).
*   `npm start:server`: Starts the compiled server.
*   `npm run dev:client`: Starts the Next.js client dev server.
*   `npm run dev`: Runs `dev:client` and `start:server` concurrently.

## 9. Future Considerations / Potential Improvements

*   **Visual Diagrams:** Incorporating Mermaid diagrams to visually represent state flows (client and server machines) and component interactions could further enhance understanding.
*   **Framer Motion Integration:** For richer client-side animations.
*   **Database Integration:** For persistent game rooms, user accounts, and leaderboards.
*   **Advanced Matchmaking/Lobby Features.**
*   **User Authentication.**
*   **More Sophisticated Server-Side Dev Watch Mode.**
*   **Granular Error Reporting and User Feedback:** Enhancing how specific errors are categorized and presented to the user.
*   **Refined Client-Side Optimism/Rollback:** For certain actions, explore client-side optimistic updates with server reconciliation for a snappier feel, though this adds complexity.
*   **Test Coverage:** Comprehensive unit and integration tests for both client and server state machines and communication. 