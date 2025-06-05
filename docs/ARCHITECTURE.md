# Architecture Overview

This document describes the high-level architecture of the Check! card game project. It covers the main components, their responsibilities, and how they interact.

## 1. Core Philosophy

The core architectural philosophy for "Check!" centers around creating a seamless and robust multiplayer card game experience. Key goals include:
*   **Real-time Multiplayer Interaction:** Ensuring that all players experience game events and state changes simultaneously and smoothly.
*   **Authoritative Server:** Maintaining a single source of truth for game state and rules on the server to prevent inconsistencies and cheating.
*   **Robust State Management:** Utilizing clear and predictable state management patterns (eventually XState) on both the server (for game logic) and client (for UI and animation orchestration) to handle complex game phases and interactions.
*   **Engaging User Experience:** Leveraging modern frontend technologies and animation libraries (like Framer Motion) to create an intuitive, visually appealing, and dynamic interface.

## 2. System Components

*   ### 2.1. Frontend (Client)
    *   **Technology:** Next.js (App Router), TypeScript, Tailwind CSS, XState, Zustand, Framer Motion (planned for animations)
    *   **Responsibilities:**
        *   Rendering the game interface (board, cards, player hands, actions).
        *   Handling user input and interactions.
        *   Managing local UI state, interaction flows, and complex animation sequences.
        *   Communicating with the backend via WebSockets (Socket.IO client).
        *   Receiving and displaying game state updates (e.g., `ClientCheckGameState`, game logs, chat) from the server and storing them in a global client-side store.
    *   **Key Directories/Modules:**
        *   `client/app/`: Core Next.js App Router structure (layouts, pages).
        *   `client/components/`: Reusable UI components (e.g., `CardComponent`, `PlayerHandComponent`, `GameBoard`, `DrawPileComponent`, `DiscardPileComponent`).
            *   `client/components/ui/`: General UI elements (buttons, modals, etc.).
            *   `client/components/game/`: Game-specific components.
            *   `client/components/layout/`: Layout components (header, footer, nav).
        *   `client/hooks/`: Custom React hooks (e.g., `useSocketManager`).
        *   `client/lib/`: Client-side utilities, helper functions.
        *   `client/machines/`: Client-side XState machine definitions (e.g., `uiMachine.ts` for UI/interaction orchestration).
        *   `client/store/`: Zustand store setup (e.g., `gameStore.ts` for `ClientCheckGameState`, logs, chat).
        *   `client/styles/`: Global styles (e.g., `globals.css` for Tailwind).

*   ### 2.2. Backend (Server)
    *   **Technology:** Node.js, Express, Socket.IO, TypeScript
    *   **Responsibilities:**
        *   Managing the authoritative game state, including rules, turns, and player data.
        *   Enforcing game logic and rules (currently procedural, with a planned refactor to XState).
        *   Processing player actions received from clients via WebSockets.
        *   Broadcasting game state updates and log messages to connected clients.
        *   Managing game rooms, player connections, disconnections, and reconnections.
    *   **Key Files/Modules:**
        *   `server/src/index.ts`: Main server entry point, Express app setup, and Socket.IO server initialization and event handling for client connections and actions.
        *   `server/src/game-manager.ts`: Contains the core game logic, including game initialization, player action handlers (e.g., `handleDrawFromDeck`, `handleAttemptMatch`), turn management, and state transitions. (This is the primary module targeted for the XState refactor).
        *   *(Soon to be added)* `server/src/game-machine.ts` (or a similar name): Will house the XState machine definition for the server-side game logic.

*   ### 2.3. Shared Logic
    *   **Technology:** TypeScript
    *   **Responsibilities:** Provides a single source of truth for data structures, type definitions (interfaces), and enumerations that are essential for consistent communication and data handling between the frontend and backend.
    *   **Key Files/Modules:**
        *   `shared-types/src/index.ts`: Contains all shared type definitions, including core game state elements like `Card`, `PlayerState`, `ServerCheckGameState`, `ClientCheckGameState`, communication contracts like `SocketEventName` and `PlayerActionType`, and important enums such as `GamePhase` and `RichGameLogMessage`.

## 3. State Management Strategy

*   **3.1. Server-Side (Authoritative Game State):**
    *   **Current:** Procedural logic within `game-manager.ts`.
    *   **Planned:** Refactor to use **XState**.
        *   An XState machine (`GameMachine`) will define all possible game states (e.g., `InitialPeekPhase`, `PlayPhase`, `MatchingStage`, `AbilityResolutionPhase`, `GameOver`), valid transitions, actions (game logic execution), and context (the full game state). Immer will be used for immutable context updates within actions.
        *   This will provide a robust, declarative, and visualizable model for the complex game flow.
*   **3.2. Client-Side (UI State & Animation Orchestration):**
    *   **Primary State Stores:**
        *   **Zustand (`client/store/gameStore.ts`):** Manages global client-side state that is primarily derived from server updates. This includes:
            *   The latest `ClientCheckGameState`.
            *   Game logs.
            *   Chat messages.
            *   Other shared data that components might need to subscribe to directly.
        *   **XState (`client/machines/uiMachine.ts`):** Orchestrates UI logic, user interaction flows, and manages temporary or derived UI-specific state. Its responsibilities include:
            *   Listening to game state updates from the server (via events from a provider that interacts with Zustand and the socket manager).
            *   Managing client-side UI states (e.g., `idle`, `awaitingServerResponse`, `playerAction.promptPendingCardDecision`, `abilityActive`, modal visibility, active animation cues).
            *   Handling user interactions (e.g., button clicks) and translating them into events for itself or preparing actions to be emitted to the server.
            *   Sequencing animations (using its state to trigger Framer Motion effects in components).
            *   Managing transient UI data like `selectedHandCardIndex` or `abilityContext` during multi-step operations.
    *   **Interaction Model:**
        *   Components primarily subscribe to Zustand for displaying core game data.
        *   Components interact with and subscribe to the `uiMachine` for UI state-dependent rendering (e.g., disabling buttons, showing modals) and to send user action events.
        *   The `uiMachine` processes these events, potentially updates its own context, and emits events (via `EMIT_TO_SOCKET`) that are then sent to the server by a socket manager (likely coordinated through a React provider that owns the XState actor).

## 4. Real-Time Communication

*   **Protocol:** WebSockets
*   **Library:** Socket.IO
*   **Flow:**
    1.  Client connects to Socket.IO server.
    2.  Client sends actions (e.g., `PlayerActionType.DRAW_FROM_DECK`) with a payload.
    3.  Server (via `game-manager.ts` and soon the XState machine) processes the action, validates it, and updates the authoritative game state.
    4.  Server broadcasts the updated `ClientCheckGameState` to all players in the relevant game room.
    5.  Server also broadcasts `RichGameLogMessage` entries for players to see game events.
    6.  Frontend receives updates and re-renders UI accordingly, potentially triggering animations managed by its local XState machine.

## 5. Key Data Structures

The integrity and consistency of the game rely on a set of well-defined data structures, primarily located in the `shared-types/src/index.ts` module. These types are used by both the server and the client. Key structures include:

*   **`Card`**: Represents a single playing card with properties like `suit`, `rank`, and an optional `id`.
*   **`PlayerState`**: Contains all information specific to a player, such as their `hand` (an array of `Card` objects), `score`, `name`, connection status (`isConnected`, `socketId`), and game-specific flags like `hasCalledCheck` or `isLocked`.
*   **`ServerCheckGameState`**: The authoritative game state maintained by the server. It includes the `deck`, `discardPile`, a map of `players` (using `PlayerState`), `currentPhase`, `currentPlayerId`, `turnOrder`, `pendingAbilities`, and other critical game-flow variables.
*   **`ClientCheckGameState`**: A version of the game state tailored for client consumption. It redacts sensitive information (like other players' hidden cards) and includes client-specific data like `deckSize` (instead of the full deck) and `viewingPlayerId`.
*   **`GamePhase`**: An enum defining the various phases of the game (e.g., `initialPeekPhase`, `playPhase`, `matchingStage`, `abilityResolutionPhase`, `gameOver`).
*   **`PlayerActionType`**: An enum listing all possible actions a player can send to the server (e.g., `DRAW_FROM_DECK`, `ATTEMPT_MATCH`, `RESOLVE_SPECIAL_ABILITY`).
*   **`SocketEventName`**: An enum defining the names of Socket.IO events used for client-server communication (e.g., `CREATE_GAME`, `JOIN_GAME`, `GAME_STATE_UPDATE`, `SERVER_LOG_ENTRY`).
*   **`RichGameLogMessage`**: A structured format for game log entries, allowing for consistent display of game events to players.

## 6. Future Considerations / Potential Improvements

*(Placeholder for ideas like database integration for persistent game rooms, advanced matchmaking, user authentication, etc.)* 