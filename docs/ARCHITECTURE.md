# ARCHITECTURE.md (v2.1 - Final, Comprehensive)

## Architecture Overview

This document describes the high-level architecture of the Check! card game project. It covers the main components, their responsibilities, and how they interact, reflecting the final, refactored state of the application.

## 1. Core Philosophy

The core architectural philosophy for "Check!" centers around creating a seamless and robust multiplayer card game experience. Key goals include:

- **Real-time Multiplayer Interaction**: Ensuring that all players experience game events and state changes simultaneously and smoothly.
- **Authoritative Server**: Maintaining a single source of truth for game state and rules on the server using XState. This prevents inconsistencies, validates all actions, and makes cheating impossible from the client-side.
- **Global & Persistent Client State**: Utilizing a single, global XState machine on the client, provided at the root of the application. This ensures a persistent state across the entire user session, seamlessly managing everything from pre-game modals to in-game interactions, disconnections, and reconnections.
- **Engaging User Experience**: Leveraging Next.js (App Router), TypeScript, and Tailwind CSS to create an intuitive and visually appealing interface, with Framer Motion used for fluid, state-driven animations.

## 2. System Components

The project is structured as a monorepo using npm workspaces, comprising three main packages: client, server, and shared-types.

### 2.1. Frontend (Client)

**Technology**: Next.js (App Router), TypeScript, XState, @xstate/react, Tailwind CSS, Framer Motion.

**Key Architectural Pattern**: The entire client application is managed by a single, global XState actor. This actor is created in a root layout component and provided to the entire React tree via the official @xstate/react context utilities.

**Key Directories/Modules**:

- `client/app/layout.tsx`: **Root Application Layout**. This is a Client Component ('use client') that houses all global providers. It uses the usePathname hook to calculate the initial input for the state machine and provides the GameUIContext.Provider to the entire application.
- `client/context/GameUIContext.ts`: **The Context Hub**. This file uses the createActorContext utility from @xstate/react to generate a strongly-typed Provider and a set of hooks (useSelector, useActorRef) for interacting with the uiMachine. This is the standard, modern way to integrate XState with React.
- `client/machines/uiMachine.ts`: **The Brain of the Client**. Defines the global uiMachine. This machine manages the entire client application lifecycle, from outOfGame (on the landing page), to inGame (with sub-states like lobby, playing, ability), and the critical promptToJoin and reconnecting states.
- `client/app/page.tsx`: **Main Landing Page**. A presentational component whose "Create Game" and "Join Game" buttons use local React state (useState) to toggle the visibility of the modals. It consumes the global GameUIContext to interact with the state machine.
- `client/components/modals/`: Contains NewGameModal.tsx, JoinGameModal.tsx, and RejoinModal.tsx. These components use the GameUIContext.useActorRef() hook to send events to the global machine. The RejoinModal is now a generic prompt used for the "Join via Link" flow.
- `client/app/game/[gameId]/page.tsx`: **Game Page Entry Point**. A minimal Server Component whose only job is to render the <GameClient> component.
- `client/app/game/[gameId]/GameClient.tsx`: **Client Boundary**. A simple Client Component that renders the main <GameUI />. It is the entry point into the interactive part of the game session.

### 2.2. Backend (Server)

**Technology**: Node.js, Socket.IO, TypeScript, XState.

**Responsibilities**:

- Managing all client connections and game actor lifecycles via the activeGameMachines Map.
- Using direct ack callbacks for reliable request/response actions (CREATE_GAME, JOIN_GAME, ATTEMPT_REJOIN).
- Subscribing to emitted events from each actor to broadcast game state (BROADCAST_GAME_STATE) or other messages (BROADCAST_CHAT_MESSAGE).
- Enforcing all game logic via the pure gameMachine.
- Handling player disconnections gracefully, allowing games to continue if possible.

**Key Files/Modules**:

- `server/src/index.ts`: The main server entry point. Manages the Socket.IO server, game instances, and all network communication patterns.
- `server/src/game-machine.ts`: The definitive source of truth for game rules. It is a pure state machine configured via input and communicates results via emit.
- `server/src/state-redactor.ts`: Provides the generatePlayerView utility, which redacts sensitive information (opponent hands, private logs) before state is broadcast to clients.

### 2.3. Shared Logic (shared-types/)

**Responsibilities**: Provides the single, unbreakable TypeScript contract for all data structures, types, and event names used by both the client and server.

## 3. High-Level Interaction Flow

### Example Flow: Creating a New Game

1. **UI Interaction**: On the landing page (/), the user opens the NewGameModal and submits their name.
2. **Client Event**: The modal's onClick handler calls `send({ type: 'CREATE_GAME_REQUESTED', ... })` using the hook from GameUIContext.
3. **Machine Emission**: The global uiMachine executes its emitCreateGame action, preparing an EMIT_TO_SOCKET event with the payload and an ack callback.
4. **Socket Transmission (Client)**: The UIMachineProvider (now inside app/layout.tsx) catches this emitted event and calls `socket.emit('CREATE_GAME', payload, ack)`.
5. **Server Reception**: server/src/index.ts receives the request, creates a new gameMachine actor, and adds the player.
6. **Direct Server Response**: The server immediately calls the ack callback with `{ success: true, gameId, playerId, gameState }`.
7. **Client State Update**: The ack handler in the uiMachine sends a GAME_CREATED_SUCCESSFULLY event to itself.
8. **Context Update & Navigation**: The uiMachine updates its context and crucially, the NewGameModal's useEffect hook (which is subscribed to the machine's state) detects the inGame state change and executes `router.push('/game/[gameId]')`.
9. **Game Page Load**: The user lands on the new page. The global uiMachine actor persists. The GameUI component renders, its selectors read the new state from the machine (gameStage is WAITING_FOR_PLAYERS), and it correctly displays the GameLobby component.

## 4. State Management Strategy

### Server-Side (Authoritative):

- **XState (game-machine.ts)**: The gameMachine is the sole source of truth. Its context holds the complete, unredacted game state. It is a pure function that takes events and produces a new state and a list of side effects to be emitted.

### Client-Side (View State):

- **Global XState (uiMachine.ts)**: A single XState machine, provided at the root of the application via createActorContext, serves as the single source of truth for the entire client application's state.

### Interaction Model:

- **Data Display**: UI Components use the GameUIContext.useSelector() hook to subscribe to specific, reactive slices of the machine's state.
- **User Actions**: UI interactions call the send() function obtained from the GameUIContext.useActorRef() hook to send strongly-typed events directly to the machine.
- **Communication**: The machine processes the event and, if necessary, emits an EMIT_TO_SOCKET event, which is handled by the provider in the root layout.

## 5. Key Data Structures

The integrity of the game relies on the well-defined structures in `shared-types/src/index.ts`. Key structures include Card, Player (the client view), ClientCheckGameState, GameMachineContext (the server view), SocketEventName, and PlayerActionType.

## 6. Error Handling Strategy

- **Server-Side**: The gameMachine identifies invalid actions and can emit specific error events. server/src/index.ts catches these and relays them to the appropriate client via the ERROR_MESSAGE socket event.
- **Client-Side**: The UIMachineProvider listens for the ERROR_MESSAGE socket event and forwards it to the uiMachine. The UI can then react, for instance, by showing a toast notification.

## 7. Testing Strategy

The project employs a multi-layered testing strategy:

- **Server Logic (game-machine.test.ts)**: Uses Vitest for behavior-driven testing. Tests interact with a running actor instance, send events, and assert the resulting state and context against the GAME_RULES.md. The suite covers game flow, special abilities, and edge cases like player disconnection and configuration options.
- **Server Network Layer (index.test.ts)**: Uses Vitest and mocks to test the Socket.IO event handlers in index.ts, ensuring requests are routed correctly and ack callbacks are handled.
- **Server Data Transformation (state-redactor.test.ts)**: Uses Vitest to unit test the pure generatePlayerView function.
- **(Future) E2E Testing**: The architecture is well-suited for end-to-end testing with frameworks like Cypress or Playwright to simulate full user flows in a browser.
