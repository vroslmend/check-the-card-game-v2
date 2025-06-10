# Architecture Overview

This document describes the high-level architecture of the Check! card game project. It covers the main components, their responsibilities, and how they interact.

## 1. Core Philosophy

The core architectural philosophy for "Check!" centers around creating a seamless and robust multiplayer card game experience. Key goals include:
*   **Real-time Multiplayer Interaction:** Ensuring that all players experience game events and state changes simultaneously and smoothly.
*   **Authoritative Server:** Maintaining a single source of truth for game state and rules on the server using XState to prevent inconsistencies and cheating.
*   **Robust State Management:** Utilizing clear and predictable state management patterns:
    *   **Server-side:** XState (`server/src/game-machine.ts`) for all game logic and authoritative state.
    *   **Client-side:** A pure XState architecture. A single root machine (`client/machines/uiMachine.ts`) manages all client-side state, from socket connection status to complex UI interaction flows.
*   **Engaging User Experience:** Leveraging Next.js (App Router), TypeScript, and Tailwind CSS to create an intuitive and visually appealing interface, with Framer Motion for animations.

## 2. System Components

The project is structured as a monorepo using npm workspaces, comprising three main packages: `client`, `server`, and `shared-types`.

*   ### 2.1. Frontend (Client)
    *   **Technology:** Next.js (App Router), TypeScript, Tailwind CSS, XState.
    *   **Responsibilities:**
        *   Rendering the game interface (lobby, game board, cards, player hands, actions).
        *   Handling user input and interactions.
        *   **Game Page State:** Managing the entire client-side state for an active game session, including the Socket.IO connection lifecycle, UI interaction flows, and animation cues via a single XState machine (`uiMachine`).
        *   **Landing Page Modals:** The modals for creating and joining a game are self-contained and handle their own logic, using direct socket communication to the server. They are not controlled by the `uiMachine`.
    *   **Key Directories/Modules:**
        *   `client/app/layout.tsx`: Root application layout, integrates global providers.
        *   `client/app/page.tsx`: The main landing page. It is a largely static page for presentation and uses modals to handle the "Create Game" and "Join Game" interactions.
        *   `client/app/game/[gameId]/page.tsx`: The primary page for rendering an active game session.
        *   `client/app/game/[gameId]/GameClient.tsx`: This is the core client-side component for an active game. It wraps the entire game experience with the `UIMachineProvider`, bringing the `uiMachine` to life for that session.
        *   `client/components/`:
            *   `game/`: Game-specific React components (e.g., `LocalPlayerArea.tsx`, `OpponentArea.tsx`).
            *   `modals/`: Contains the `NewGameModal` and `JoinGameModal`, which are self-contained and use direct socket communication.
            *   `ui/`: General UI elements (e.g., buttons, base `Modal` component).
            *   `providers/`: Contains the core `UIMachineProvider`.
        *   `client/machines/uiMachine.ts`: Defines the client-side XState machine (`uiMachine`) that orchestrates all client-side logic **while in an active game**. It manages the socket connection state, the `ClientCheckGameState`, user interaction flows, and temporary UI-specific state. It triggers server communication by emitting `EMIT_TO_SOCKET` events.
        *   `client/components/providers/uiMachineProvider.tsx`: A "smart" provider that acts as the bridge between the React component tree, the `uiMachine` actor, and the Socket.IO connection **for a specific game session**. Its responsibilities are:
            *   Spawning and providing the `uiMachine` actor instance to the component tree.
            *   Registering listeners for all relevant incoming Socket.IO events (e.g., `GAME_STATE_UPDATE`, `SERVER_LOG_ENTRY`) and forwarding them as events to the `uiMachine` actor.
            *   Subscribing to `EMIT_TO_SOCKET` events from its `uiMachine` actor and sending the corresponding event and payload to the server via the socket.
            *   Managing the raw socket connection lifecycle (`connect`, `disconnect`) and syncing this status with the `uiMachine`.
        *   `client/lib/socket.ts`: Exports a singleton `socket` instance, configured for client-side use.

*   ### 2.2. Backend (Server)
    *   **Technology:** Node.js, Socket.IO, TypeScript, XState.
    *   **Responsibilities:**
        *   Managing all client connections via Socket.IO.
        *   Instantiating, managing, and destroying XState game machine actors (`gameMachine`) for each active game. When a `gameMachine` reaches its final state, its reference is removed from the active `Map`.
        *   Routing incoming socket events from clients (e.g., `PLAYER_ACTION`, `CREATE_GAME`) to the appropriate `gameMachine` actor instance.
        *   Subscribing to each actor's snapshot. On each new snapshot, it processes the `snapshot.emitted` array to react to events from the machine.
        *   Broadcasting game state updates (`ClientCheckGameState`), log messages (`RichGameLogMessage`), and other relevant information to clients based on the `gameMachine`'s emitted events.
        *   Enforcing all game logic and rules via the `gameMachine`.
    *   **Key Files/Modules:**
        *   `server/src/index.ts`:
            *   Main server entry point. Initializes the HTTP server and Socket.IO server.
            *   Manages a map of active `gameMachine` actor references (`activeGameMachines`). Handles cleanup of actors when their machines terminate.
            *   Handles new client connections, event routing (`CREATE_GAME`, `JOIN_GAME`, `PLAYER_ACTION`, etc.), and disconnects.
            *   Subscribes to each spawned actor's snapshot stream. For each snapshot, it iterates through any `snapshot.emitted` events and calls the appropriate broadcasting or client-specific communication functions. This is the primary mechanism for reacting to game logic outcomes.
        *   `server/src/game-machine.ts`:
            *   The definitive source of truth for all game rules, state transitions, and player action validation.
            *   Implemented as an XState state machine. This manages game phases, player turns, and game-over conditions.
            *   It is pure logic; it does not directly interact with sockets. Instead, it processes events and uses the `emit` action creator. These emitted events are collected in the `snapshot.emitted` array, which `server/src/index.ts` uses to communicate with clients.
        *   `server/src/state-redactor.ts`:
            *   **Primary active role:** Provides the `generatePlayerView` utility function. This function takes the full `GameMachineContext` and a `viewingPlayerId`, returning a `ClientCheckGameState` with sensitive information redacted.
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
    *   **Game State Broadcasting & Utilities (`server/src/state-redactor.ts`):**
        *   **Player View Generation:** Its most critical current function is `generatePlayerView`. When `server/src/index.ts` receives a `BROADCAST_GAME_STATE` emission from a `gameMachine`, it calls `generatePlayerView(machine.getContext(), viewingPlayerId)`. This function takes the full server-side game state and a specific player's ID, returning a `ClientCheckGameState` tailored for that player (e.g., redacting other players' hidden cards, showing only deck size instead of full deck). This ensures players only see what they're supposed to.
        *   **Legacy Logic:** This file previously contained more logic, but its role has been correctly focused on state redaction. The XState `gameMachine` (`server/src/game-machine.ts`) now encapsulates all game mechanics directly.

## 3. High-Level System Flow and Interaction

This section provides a bird's-eye view of how the major architectural pieces of the "Check!" game work together.

*   **Monorepo Structure:** The project is divided into three main packages:
    *   `shared-types/`: The bedrock of communication. It defines all TypeScript types, enums, and interfaces used by both the client and server. This ensures that data structures (like cards, player states, game states, event payloads) are consistent across the entire application, preventing mismatches and errors.
    *   `server/`: The authoritative backend. Its primary responsibilities include managing game instances, enforcing game rules, and facilitating real-time communication.
    *   `client/`: The frontend interface. It's responsible for rendering the game for the user, capturing player inputs, and reflecting game state changes.

*   **Core Server Operations (`server/`):**
    *   **Socket.IO Hub (`server/src/index.ts`):** This is the entry point for all client connections. It handles establishing and managing Socket.IO sessions.
    *   **Game Logic Authority (`server/src/game-machine.ts`):** For each active game, an XState machine instance (the `gameMachine`) is spawned. This machine is the *single source of truth* for all game logic. It receives game-related events, processes them, updates its internal state, and emits events to signal changes.
    *   **Game State Broadcasting:** `server/src/index.ts` subscribes to the actor's snapshot. When a new snapshot is available, it processes the `snapshot.emitted` array. Based on the events in that array (e.g., `BROADCAST_GAME_STATE`), it uses the `generatePlayerView` function to create a tailored, redacted version of the game state for each player, which is then broadcasted via Socket.IO.
    *   **`server/src/state-redactor.ts`:** Its most critical current role is providing the `generatePlayerView` utility. Other logic has been migrated to the `gameMachine`.

*   **Client-Side Architecture (`client/`):**
    *   **User Interface (React Components):** Renders the game. On the landing page, modals handle creating/joining games. On the game page, components subscribe to the `uiMachine`.
    *   **Socket Communication:**
        *   **On the landing page,** the modals for creating/joining games manage their own temporary socket connection and use `socket.emit` with a callback to handle the server's response.
        *   **On the game page,** the `UIMachineProvider` manages the persistent socket connection for the game session.
    *   **UI Orchestration (`client/machines/uiMachine.ts`):** **For in-game logic only.** An XState machine that manages complex UI flows and user interactions during a game.
    *   **Central Orchestrator (`client/machines/uiMachineProvider.tsx`):** **For in-game logic only.** A "smart" provider that hosts the `uiMachine` actor and connects it to the socket and the React UI.

*   **Typical Interaction Flow (Example: Player Drawing a Card - In-Game):**
    1.  **User Input:** Player clicks the "Draw Card" button in the client UI.
    2.  **UI Machine Event:** The React component's `onClick` handler sends an event to the `uiMachine` via the `useUI()` hook.
    3.  **Action Emission:** The `uiMachine` processes this event and emits an `EMIT_TO_SOCKET` side-effect.
    4.  **Socket Transmission (Client):** The `UIMachineProvider` catches the `EMIT_TO_SOCKET` event and calls `socket.emit()`.
    5.  **Server Reception:** `server/src/index.ts` receives the `PLAYER_ACTION`.
    6.  **Game Logic Processing:** `server/src/index.ts` forwards the action to the appropriate `gameMachine` instance.
    7.  **State Update & Emission:** The `gameMachine` updates its context and its next snapshot contains emitted events (like `BROADCAST_GAME_STATE`).
    8.  **Broadcast Preparation:** `server/src/index.ts` processes the emitted events.
    9.  **Socket Transmission (Server):** `server/src/index.ts` sends `GAME_STATE_UPDATE` to clients.
    10. **Client Reception & State Update:** The `UIMachineProvider`'s socket listeners forward the event to the `uiMachine`.
    11. **UI Re-render:** The `uiMachine` updates its context, and subscribed React components re-render.

This interconnected system ensures that the server remains the authority on game state, while the client provides a responsive and interactive user experience, with `shared-types` ensuring both sides speak the same language.

## 4. State Management Strategy

*   **4.1. Server-Side (Authoritative Game State):**
    *   **XState (`server/src/game-machine.ts`):** The `gameMachine` is the **sole and definitive source of truth** for all game rules, states, valid transitions, and actions that execute game logic.
    *   The machine's `context` (`GameContext`) holds the complete server-side game state.
    *   Client actions (received by `server/src/index.ts` via Socket.IO) are translated into `GameEvent`s and sent to the corresponding `gameMachine` actor instance.
    *   The `gameMachine` processes these events, updates its context immutably (via XState's `assign`), and uses `emit` to create side-effects that are handled by `server/src/index.ts` to communicate changes back to clients.

*   **4.2. Client-Side (UI State, Local Data Cache, Interaction Orchestration):**
    *   A pure XState architecture is used.
    *   **XState (`client/machines/uiMachine.ts`):**
        *   Serves as the single source of truth for the entire client application.
        *   It manages the socket connection status, holds the `ClientCheckGameState`, game logs, chat messages, and all transient UI state (e.g., selected cards, ability progress).
        *   It is the central point for all client-side logic.
    *   **`UIMachineProvider` (`client/components/providers/uiMachineProvider.tsx`):**
        *   The vital link between the `uiMachine` and the outside world (React UI and Socket.IO server).
        *   It listens to socket events and translates them into `uiMachine` events.
        *   It listens for `EMIT_TO_SOCKET` events from the `uiMachine` and sends them to the server.
    *   **Interaction Model:**
        1.  **Data Display:** UI Components subscribe to the `uiMachine`'s state via the `useUI` hook.
        2.  **User Actions:** UI interactions send events directly to the `uiMachine`.
        3.  **Client-Side Logic:** `uiMachine` processes all events, updates its context, and determines if communication with the server is necessary.
        4.  **Sending to Server:** If needed, `uiMachine` emits an `EMIT_TO_SOCKET` event, which the `UIMachineProvider` catches and sends over the socket.
        5.  **Receiving from Server:** The `UIMachineProvider`'s socket listeners receive an event and send a corresponding event to the `uiMachine`.
        6.  **State Update & UI Re-render:** The `uiMachine` updates its context, and all subscribed components re-render automatically.

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
        *   The client's `uiMachine` emits an `EMIT_TO_SOCKET` event. The `UIMachineProvider` sends this as a `SocketEventName.PLAYER_ACTION` with a payload like `{ type: 'DRAW_FROM_DECK', playerId: '...' }` to the server.
        *   `server/src/index.ts` receives this and sends the event (e.g., `{ type: 'DRAW_FROM_DECK', playerId: '...' }`) to the correct `gameMachine` actor.
    4.  **Server Game Logic Processing (`gameMachine`):**
        *   `gameMachine` receives the `DRAW_FROM_DECK` event.
        *   It validates the action (guards) and executes actions (updating context).
        *   The new snapshot produced by this transition will contain an array of `emitted` events, such as `EMIT_LOG_PUBLIC`, `EMIT_LOG_PRIVATE`, and `BROADCAST_GAME_STATE`.
    5.  **Server Broadcast (`server/src/index.ts`):**
        *   Receives the new snapshot from its subscription to the actor.
        *   It iterates through the `snapshot.emitted` array.
        *   For log events, it sends `SERVER_LOG_ENTRY` to the relevant clients.
        *   For `BROADCAST_GAME_STATE`, it calls `generatePlayerView` for each player and sends them their tailored `GAME_STATE_UPDATE`.
    6.  **Client Receives Update:**
        *   The `UIMachineProvider`'s socket listener for `GAME_STATE_UPDATE` receives the data and sends a `CLIENT_GAME_STATE_UPDATED` event to the `uiMachine`.
        *   The `uiMachine` updates its context.
        *   UI components subscribed to the `uiMachine` re-render.

## 6. Key Data Structures

The integrity and consistency of the game rely on well-defined data structures in `shared-types/src/index.ts`.
*   **`Card`**: `{ suit: Suit, rank: Rank, id: string }`. `id` is crucial.
*   **`PlayerState` (Server)**: Holds full player data: `hand: Card[]` (with `isFaceDownToOwner` flags), `score`, `name`, `isConnected`, `socketId`, `hasCalledCheck`, `isLocked`, `pendingDrawnCard`, `pendingSpecialAbility`, etc.
*   **`ClientPlayerState`**: Redacted view for clients, `hand: ClientCard[]` (where `ClientCard` can be `Card` or `HiddenCard`).
*   **`ServerCheckGameState`**: Authoritative server state: `deck: Card[]`, `discardPile: Card[]`, `players: { [playerID: string]: PlayerState }`, `currentPhase: GamePhase`, `currentPlayerId`, `turnOrder`, `pendingAbilities: PendingSpecialAbility[]`, `matchingOpportunityInfo`, `gameMasterId`, `logHistory`, `gameover: GameOverData | null`, etc.
*   **`ClientCheckGameState`**: Redacted for client: `deckSize: number`, `players: { [playerID: string]: ClientPlayerState }`, `viewingPlayerId`, etc.
*   **`GameMachineContext`**: Extends `ServerCheckGameState`, adding `gameId`. This is the context object of the `server/src/game-machine.ts`.
*   **`GameMachineEvent`**: Union of all possible events the `gameMachine` can process. Defines the machine's input contract.
*   **`GameMachineEmittedEvents`**: Union of events the `gameMachine` can emit for `server/src/index.ts` to act upon. These are placed in the `snapshot.emitted` array by the machine and define its output contract.
*   `SocketEventName`: Enums for all client-server socket event names.
*   `PlayerActionType`: Enums for all player actions sent within the `PLAYER_ACTION` socket event.
*   `RichGameLogMessage`, `ChatMessage`: For structured logging and chat.
*   **Client-Side:** The `UIMachineProvider` forwards `SocketEventName.ERROR_MESSAGE` events from the server into the `uiMachine`. The `uiMachine` can then transition to an error state or update its context, allowing the UI to display a toast notification or modal.

## 7. Error Handling Strategy

*   **Server-Side:** The `gameMachine` can identify invalid actions or inconsistent states. When an error occurs that needs client notification, it emits an `EMIT_ERROR_TO_CLIENT` event, often including a `playerId` if the error is specific, and a descriptive `message`.
*   **Server `index.ts`:** Listens for `EMIT_ERROR_TO_CLIENT` from the game machine and relays the error information to the specified client(s) using the `SocketEventName.ERROR_MESSAGE` (or a general purpose server message).
*   **Client-Side:** The `UIMachineProvider`'s socket listeners catch `SocketEventName.ERROR_MESSAGE` events and forward them to the `uiMachine`. The `uiMachine` can then transition to an error state or update its context, allowing the UI to display a toast notification or modal.

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

## 10. Development Guidelines & Conventions

This section provides actionable rules and conventions to ensure consistency and maintainability during development.

*   **Golden Rule:** When in doubt, prioritize clarity and simplicity over cleverness. Code should be easy for another developer (or your future self) to understand.

*   **Component Design Philosophy:**
    *   **Stateless by Default:** Components, especially those in `client/components/ui/`, should be stateless whenever possible. They should receive data and callbacks via props.
    *   **Minimal State:** When state is necessary, keep it as localized as possible.
    *   **Component Granularity:** If a component's render logic becomes too long, strongly consider breaking it down into smaller, more focused sub-components.

*   **State Management Rules:**
    *   **XState (`/machines/uiMachine.ts`):** This is the single source of truth for all client-side state **during an active game**. Use it to manage the game state received from the server, the socket connection status, and any complex UI interaction flows. Components get this state via the `useUI` hook.
    *   **React State (`useState`):** For simple, component-local state. This is used effectively in the `NewGameModal` and `JoinGameModal` to handle their own loading and input states, which is the correct pattern for self-contained components.
    *   **No Other State Managers:** Avoid introducing other global state management libraries (like Zustand, Redux, or Jotai) to maintain architectural simplicity.

*   **Styling and CSS Conventions:**
    *   **Utility-First:** All styling should be done using Tailwind CSS utility classes directly in the JSX of the components.
    *   **No New CSS Files:** Avoid adding new `.css` files or adding styles to `globals.css` unless it's for a truly global style or a third-party library requirement.
    *   **`cn` Utility:** Use the `cn` utility function from `client/lib/utils.ts` for conditionally applying classes.

*   **File and Naming Conventions:**
    *   **Components:** `PascalCase` (e.g., `PlayerHand.tsx`).
    *   **Hooks:** `useCamelCase` (e.g., `useSocketManager.ts`).
    *   **Types/Interfaces:** `PascalCase` (e.g., `interface GameBoardProps`).
    *   **Directory Structure:** Adhere to the established structure (`/components`, `/hooks`, `/lib`, `/machines`, etc.). New components or utilities should be placed in the appropriate directory. 