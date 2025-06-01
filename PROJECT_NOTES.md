# Project Notes: "Check" - Online Multiplayer Card Game

## Framework & Core Technologies (DO NOT OVERWRITE)
*   **Backend:** Node.js, Express.js (implicitly via Socket.IO's HTTP server), Socket.IO, TypeScript
*   **Frontend:** Next.js (with React), TypeScript, Tailwind CSS
*   **Shared Logic/Types:** TypeScript (in `shared-types/` directory)

## Current Status: Major Refactor - `boardgame.io` to Socket.IO Backend

The project has undergone a significant refactor to replace the `boardgame.io` library with a custom backend using Node.js, Express, and `socket.io`, while retaining the Next.js frontend.

### ✅ What is DONE (Socket.IO Refactor - As of this update)

**Server-Side (`server/`)**
*   **Socket.IO & HTTP Server Setup:**
    *   Dependencies: `socket.io` installed. `boardgame.io` and related dependencies removed from `server/package.json`.
    *   `server/src/index.ts` reconfigured:
        *   Uses Node.js `http` server with `socket.io` `Server` attached (port 8000).
        *   Basic `socket.io` connection (`io.on('connection', ...)`) and disconnection handlers.
        *   CORS configured for `http://localhost:3000`.
        *   Player ID management on socket connection (`socket.data.playerId`).
*   **Game State Management & Core Logic (`server/src/game-manager.ts`):**
    *   `GameManager` concept established to handle game rooms, game state, and core game logic.
    *   **Types & Initial Structure (integrated with `shared-types`):**
        *   Uses `Card`, `PlayerState`, `ServerCheckGameState` from `shared-types`.
        *   `ServerCheckGameState` now includes fields previously managed by `boardgame.io`'s `ctx` (e.g., `currentPhase`, `currentPlayerId`, `turnOrder`, `activePlayers`, `pendingAbilities`, `matchResolvedDetails`, `gameover`).
        *   `createDeck()` and `simpleShuffle()` (placeholder) implemented.
        *   `GameRoom` interface (`gameId`, `gameState`) and an in-memory `activeGames` store defined.
    *   **Game Initialization & Player Management:**
        *   `initializeNewGame(gameId, playerSetupData)`: Creates a new game, deals initial hands, sets up initial `ServerCheckGameState` (including `currentPhase: 'initialPeekPhase'`, `currentPlayerId`, `turnOrder`, `activePlayers` for peek, `matchResolvedDetails: null`, `pendingAbilities: []`, `gameover: null`).
        *   `getGameRoom(gameId)`: Retrieves an active game room.
        *   `addPlayerToGame(gameId, playerInfo)`: Adds a player to an existing game, deals their initial 4 cards, and initializes their state.
    *   **Player View / State Redaction:**
        *   `generatePlayerView(fullGameState, viewingPlayerId)` function created to redact sensitive information (other players' hands, full deck state) and produce `ClientCheckGameState`.
*   **Socket Event Handlers (`server/src/index.ts` integrating with `game-manager.ts`):**
    *   `createGame`: Calls `initializeNewGame`, client joins `socket.io` room, sends back `gameId` and a player-specific `gameState` (via `generatePlayerView`).
    *   `joinGame`: Calls `addPlayerToGame`, client joins room, notifies others with `playerJoined`, sends player-specific `gameState` to all clients in the room.
    *   `playerAction` (generic handler for `{ gameId, playerId, type, payload }`):
        *   Calls corresponding game logic functions from `game-manager.ts` based on `type`.
        *   Broadcasts player-specific `gameStateUpdate` views (via `generatePlayerView`) to all clients in the room. For `declareReadyForPeek`, this handles the first broadcast (peek start), while the second (peek end) is triggered by `game-manager` via an injected broadcast function.
*   **Ported & Refactored Game Moves/Logic (in `game-manager.ts`):**
    *   `handleDrawFromDeck(gameId, playerId)`
    *   `handleDrawFromDiscard(gameId, playerId)`
    *   `handleSwapAndDiscard(gameId, playerId, handIndex)`: Sets `matchingOpportunityInfo` (now including `potentialMatchers`), transitions phase to `matchingStage`.
    *   `handleDiscardDrawnCard(gameId, playerId)`: Sets `matchingOpportunityInfo` (now including `potentialMatchers`), transitions phase to `matchingStage`.
    *   `handleAttemptMatch(gameId, playerId, handIndex)`:
        *   Adds K/Q/J pair abilities to `G.pendingAbilities` array (instead of `player.pendingSpecialAbility`).
        *   Handles auto-"Check".
        *   Sets `G.matchResolvedDetails` and calls `checkMatchingStageEnd`.
    *   `handlePassMatch(gameId, playerId)`: Updates `G.activePlayers`, calls `checkMatchingStageEnd`.
    *   `checkMatchingStageEnd(gameId)` (helper): Sole decider for phase transitions out of `matchingStage`. Checks `G.matchResolvedDetails` or if all players passed. Adds discard-source abilities to `G.pendingAbilities`. Calls appropriate phase setup helpers.
    *   `handleCallCheck(gameId, playerId)`: Calls `setupFinalTurnsPhase`.
    *   `handleResolveSpecialAbility(gameId, playerId, abilityArgs)`:
        *   Processes abilities from `G.pendingAbilities`.
        *   Handles K, Q, J abilities (swaps, peeks - peek targets from `abilityArgs`).
        *   Fizzles for locked players (implicit, as abilities are on `G` not player).
        *   Sets `G.lastPlayerToResolveAbility` and `G.lastResolvedAbilitySource`.
        *   Calls `setupAbilityResolutionPhase` or next phase setup if no more abilities.
    *   `handleDeclareReadyForPeek(gameId, playerId)`: Now an `async` function. When all players are ready, it sets `player.cardsToPeek` (bottom two cards: indices 2 and 3) and `player.peekAcknowledgeDeadline`. After a server-side timeout (`PEEK_TOTAL_DURATION_MS`), it automatically clears peek state, marks peek as completed for all players, and transitions the game to `playPhase` via `setupNextPlayTurn`.
    *   `handleAcknowledgePeek(gameId, playerId)`: Removed. The peek completion is now automated by a server-side timer triggered in `handleDeclareReadyForPeek`.
    *   **Peek Broadcast Fix**: Modified `handleDeclareReadyForPeek` in `game-manager.ts` to be synchronous for its immediate return. It now sets `cardsToPeek` and returns the state for an immediate broadcast when all players are ready (peek starts). A `setTimeout` is scheduled, and its callback (after peek duration) updates the game state (clears `cardsToPeek`, advances phase) and then calls a new `triggerBroadcast` function (passed from `index.ts`) to send a second broadcast with the post-peek state. `index.ts` was updated to provide this broadcast function to `game-manager.ts` and correctly handle the immediate broadcast from `handleDeclareReadyForPeek`.
*   **Phase Setup Helper Functions (in `game-manager.ts`):**
    *   `setupNextPlayTurn(gameId)`: Finds next non-locked player for `playPhase`. Transitions to scoring if check called and no one else can play.
    *   `setupFinalTurnsPhase(gameId, checkerPlayerId)`: Sets up for final turns, resets `finalTurnsTaken`. Determines first player for final turns.
    *   `setupAbilityResolutionPhase(gameId)`: Finds the player with the highest priority pending ability from `G.pendingAbilities` (LIFO logic for `'stack' -> 'stackSecondOfPair'` using `pairTargetId` and `G.lastPlayerToResolveAbility`). Transitions to next phase if no abilities.
    *   `setupScoringPhase(gameId)`: Calculates scores, determines `roundWinner`, sets `G.gameover`.
    *   `continueOrEndFinalTurns(gameId)`: Manages turn-by-turn progression in `finalTurnsPhase`, incrementing `finalTurnsTaken` and finding the next player or transitioning to scoring. Called by `setupNextPlayTurn` and `setupAbilityResolutionPhase` when appropriate.
*   **Build Error Resolution & Code Cleanup:**
    *   Outdated `server/src/game-definition.ts` (from `boardgame.io`) deleted.
    *   Numerous TypeScript errors related to type mismatches and undefined properties resolved in `game-manager.ts` and `shared-types`.
    *   Corrected `potentialMatchers` logic.
    *   Ensured `playerId` is included in all `PendingSpecialAbility` objects.
    *   Resolved issues with `PEEK_COUNTDOWN_SECONDS`, `PEEK_REVEAL_SECONDS` constants.
    *   Fixed type errors in `generatePlayerView` related to `HiddenCard` IDs and player `name` property.

**Shared Types (`shared-types/`)**
*   **Comprehensive Type Update for Socket.IO Backend:**
    *   `InitialPlayerSetupData` interface moved here.
    *   `PlayerState` updated: added `cardsToPeek`, `peekAcknowledgeDeadline`. Removed `pendingSpecialAbility` (now on `CheckGameState`). `name` property is not part of `PlayerState`.
    *   `CheckGameState` (aliased as `ServerCheckGameState` in server) significantly updated:
        *   Added: `currentPhase`, `currentPlayerId`, `turnOrder`, `activePlayers`, `pendingAbilities: PendingSpecialAbility[]`, `matchResolvedDetails`, `gameover`, `lastPlayerToResolveAbility`, `lastResolvedAbilitySource`, `lastResolvedAbilityCardForCleanup`.
        *   `matchingOpportunityInfo` updated to include `potentialMatchers: string[]`.
    *   `PendingSpecialAbility` interface now includes `playerId`.
    *   `ClientCard` (union of `Card` and `HiddenCard`), `ClientPlayerState`, `ClientCheckGameState` (includes `viewingPlayerId`, `deckSize`) defined for tailored client views. `ClientPlayerState` has optional `name`. `HiddenCard` requires an `id`.
    *   `AbilityArgs` interface updated for King peek and J/Q swap targets.
    *   Card values (Ace: -1, J:11, Q:12, K:13) confirmed.

**Frontend (`frontend/`)**
*   **Socket.IO Client Setup & `boardgame.io` Removal:**
    *   Dependencies: `socket.io-client` installed. `boardgame.io` and `react-boardgame` removed from `frontend/package.json`.
    *   `frontend/app/components/CheckGameClient.tsx` deleted.
    *   `frontend/app/page.tsx` refactored:
        *   Initializes `socket.io-client` connection to `http://localhost:8000`.
        *   Manages socket connection state, game state (`ClientCheckGameState`), `gameId`, `playerId`, and errors using React hooks.
        *   Sets up listeners for `connect`, `disconnect`, `connect_error`, `gameStateUpdate`, and `playerJoined`.
        *   UI for "Create Game" and "Join Game", emitting corresponding socket events.
        *   `sendPlayerAction` function emits actions to the server.
        *   Renders `<CheckGameBoard />` with new props: `gameState`, `playerId`, `onPlayerAction`.
*   **Component Refactoring for Socket.IO State:**
    *   `frontend/app/components/CheckGameBoard.tsx` extensively refactored:
        *   Props changed to `gameState: ClientCheckGameState | null`, `playerId: string | null`, `onPlayerAction: (type: string, payload?: any) => void`.
        *   Removed internal `boardgame.io` specific logic (`G`, `ctx`, `moves`, `isActive`).
        *   Action handlers (e.g., for draw, discard, match, pass, ability resolution) now call `onPlayerAction`.
        *   UI conditionals and data display updated to use `gameState` and `playerId`.
        *   Initial peek flow UI (ready button, countdown, card reveal) adapted for server-driven state (`player.cardsToPeek`, `player.peekAcknowledgeDeadline`). The "Acknowledge Peek" button and its corresponding client-side handler (`handleAcknowledgePeek`) have been removed, as peek completion is now automated by the server.
        *   Corrected logic for passing `cardsToForceShowFaceUp` to `PlayerHandComponent`, ensuring it targets the correct cards (from `handToShow`) during initial peek reveal.
        *   UI for matching stage, ability resolution (target selection for King/Queen/Jack), and calling "Check" implemented/updated.
        *   Debug output updated.
    *   `frontend/app/components/CardComponent.tsx`: Prop `card` changed to `ClientCard | null`. Renders hidden cards as placeholders. `id` property added to `ClientCard` where appropriate.
    *   `frontend/app/components/PlayerHandComponent.tsx`:
        *   Props changed to use `ClientPlayerState`, `ClientCard[]`.
        *   Logic for determining card visibility (face-up/down) updated for `ClientCard` and peek scenarios (`cardsToForceShowFaceUp`, `handToShow`).
        *   Refined `showFaceUp` logic to ensure player's own cards are face-down by default, only showing face-up if `cardsToForceShowFaceUp` dictates (e.g., during initial peek reveal or ability peeks). This fixed an issue where all of the player's own cards were incorrectly visible by default.
*   **Linter Error Resolution (Frontend):**
    *   Resolved numerous TypeScript errors in `CheckGameBoard.tsx`, `CardComponent.tsx`, `PlayerHandComponent.tsx` related to new prop types and state structure.
    *   Addressed React specific errors (e.g. `ReactNode` type issues for button content).

**Reconnection Logic (Client + Server)**
*   **Client-Side (`frontend/app/page.tsx`):**
    *   Stores `gameId`, `playerId`, and `playerName` in `localStorage`.
    *   On load, attempts to retrieve session info and emits `attemptRejoin` to the server.
    *   Handles server response for rejoin (success/failure), updates state accordingly.
    *   `createGame` and `joinGame` updated to store session info and use server-provided `playerId`.
*   **Server-Side (`server/src/index.ts`, `server/src/game-manager.ts`):**
    *   `PlayerState` in `shared-types` updated with `isConnected: boolean` and `socketId: string`.
    *   `game-manager` updated to initialize and manage `isConnected` and `socketId` for players.
    *   New `markPlayerAsDisconnected` and `attemptRejoinGame` methods in `game-manager`.
    *   `index.ts` (main server file) handles new `attemptRejoin` socket event.
    *   On socket `disconnect`, player is marked as disconnected in `game-manager`.
    *   `socketId` passed correctly during game creation and joining.
    *   Game state broadcasts now include player connection status implicitly through `PlayerState` updates.
    *   Basic session tracking (`socketSessionMap`) added to `index.ts` to map `socket.id` to `gameId` and `playerId`.

### ⏳ What is LEFT / Next Steps

*   **Thorough Runtime Testing & Debugging (Client + Server):**
    *   Start the server (`npm run dev` in `server/`).
    *   Start the client (`npm run dev` in `frontend/`).
    *   Play through all game phases, testing all actions, player counts, edge cases.
    *   Identify and fix runtime bugs in game logic, state updates, and UI rendering.
    *   Verify player view redaction is working correctly.
    *   Ensure phase transitions are smooth and correct.
*   **Server-Side Refinements:**
    *   Replace `simpleShuffle()` with a robust shuffling algorithm (e.g., Fisher-Yates).
    *   Consider error handling and validation for socket events and game actions more deeply.
    *   Persistency: If desired, replace in-memory `activeGames` with a database solution (e.g., Redis).
*   **Frontend UI/UX Enhancements:**
    *   Improve visual styling and layout for a more polished game board.
    *   Add a game log/message area to display important events.
    *   Enhance UI for ability target selection (e.g., visual cues for selectable cards/players).
    *   Display scores clearly at the end of the round.
    *   Consider adding player names to the display (requires storing them on `PlayerState` server-side, propagating to `InitialPlayerSetupData` during game init, and passing via `ClientPlayerState`).
*   **Deployment Considerations:**
    *   The user noted Vercel's lack of WebSocket support. If deploying there, an alternative hosting solution for the Socket.IO server will be needed, or a different communication method (e.g., long polling, though less ideal for real-time games).
*   (Optional) User authentication, lobbies, multi-round game sessions, persistent leaderboards.
*   **Check Call**
    *  Check the functionality for game ending as currently thats not working properly.
    * Improve ui

---

## UI Redesign Implementation Plan (Minimal & Sleek, Richio-inspired)

**Goal:** Transform the game's UI to a minimal, modern, and sleek look inspired by Richio and similar card games.

### Step-by-Step Plan

1. **Design Foundation**
   - ✅ Minimal color palette, modern font, Tailwind v4 ready.
2. **Layout Refactor**
   - ✅ Centered board, responsive flex/grid, whitespace-based separation.
3. **Card Component Redesign**
   - ✅ Minimal, modern CardComponent (white, rounded, accent border, smooth hover, suit color, responsive size).
4. **Player Hand Component**
   - ✅ Minimal, modern PlayerHandComponent (clean grid, status badges, soft backgrounds, responsive, accessible).
5. **Board Layout & Piles**
   - ✅ Minimal DrawPileComponent and DiscardPileComponent (white, shadow, subtle labels, responsive, accessible).
6. **Action Bar & Buttons**
   - ✅ Floating, pill-shaped ActionBarComponent for all in-game actions (draw, discard, match, check, pass, ability, etc.).
7. **Game State & Info**
   - ✅ Minimal phase banner, turn indicator, and floating GameLogComponent (collapsible, recent events, mobile-friendly).
8. **End-of-Game Experience**
   - ✅ EndOfGameModal: modern, celebratory modal with winner(s), scores, and Play Again button.
9. **Accessibility & Polish**
   - In progress: Keyboard navigation, colorblind icons, loading states, further polish.
10. **Testing & Iteration**
   - In progress: Cross-device testing, feedback, and UI/UX tweaks.

### New Components Summary
- **ActionBarComponent:** Floating, pill-shaped action bar for all player actions, responsive and minimal.
- **EndOfGameModal:** Modern modal overlay for round end, showing winner(s), scores, and Play Again.
- **GameLogComponent:** Floating, collapsible panel for recent game events, mobile-friendly, minimal.

### ⏳ What is LEFT / Next Steps
- Further polish: animations (e.g., card draw/discard, confetti), ability resolution UI, player badges, and visual cues.
- Accessibility: keyboard navigation, colorblind support, loading/waiting states.
- Optional: Game log enhancements, player avatars, sound effects, advanced end-of-game experience.
- Cross-device testing and feedback-driven iteration.

*Last Updated: 2024-06-10*

---

## Session Notes (Recent Updates - YYYY-MM-DD)

This session focused on further refining special ability logic, improving UI/UX for game flow and presentation, and enhancing the project's overall aesthetic.

*   **Special Card Abilities (King, Queen, Jack) - Stage & UI Synchronization:**
    *   **Problem:** Players sometimes received multiple ability resolutions for a single card discard (e.g., multiple King swaps). Ability UI on the client (buttons/prompts) sometimes showed incorrect stages like "Finalize (Stage: undefined)".
    *   **Fixes (Server - `server/src/game-manager.ts`):**
        *   Ensured `G.matchingOpportunityInfo` is correctly nullified in `handleResolveSpecialAbility` after a discard-sourced ability (`'discard'` or `'stackSecondOfPair'`) is fully resolved, preventing it from being re-processed.
        *   Modified `handleAttemptMatch` (for paired K/Q/J matches) and `checkMatchingStageEnd` (for discard-sourced K/Q/J abilities) to initialize the `currentAbilityStage` property on `PendingSpecialAbility` objects to `'peek'` (for K/Q) or `'swap'` (for J) when they are first added to `G.pendingAbilities`.
    *   **Fixes (Client - `frontend/app/components/CheckGameBoard.tsx`):**
        *   Refactored `getActions` (button labels), `actionBarPrompt` (instructional text), `canPlayerPerformAbilityAction` (action validation), and `handleResolveSpecialAbility` (action dispatch) to consistently use the server-authoritative `currentAbilityStage` from the `gameState.pendingAbilities[0]` object.
        *   Updated the `useEffect` hook responsible for resetting local ability-related state (`abilityArgs`, `multiSelectedCardLocations`) to include `currentAbilityStage` in its dependency signature. This ensures client state is correctly reset when the server advances an ability's stage (e.g., from peek to swap).
*   **UI - Card Selection for Abilities:**
    *   **Problem:** Players could not correctly select two cards simultaneously for an ability's swap stage; selecting a second card would often deselect the first.
    *   **Fix (Client - `frontend/app/components/CheckGameBoard.tsx`):**
        *   Refactored the `setMultiSelectedCardLocations` updater logic within the `handleCardClick` function. It now correctly uses the server-provided `currentAbilityStage` to manage selections:
            *   King peek: up to 2 cards.
            *   Queen peek: 1 card.
            *   King/Queen/Jack swap: up to 2 cards (if a 3rd is selected, the oldest is replaced).
            *   Clicking an already selected card deselects it.
*   **UI/UX - "Play Again" Functionality:**
    *   **Change:** The "Play Again" button in the `EndOfGameModal` now returns the user to the main lobby/landing page.
    *   **Implementation:**
        *   Added a `handleReturnToLobby` function in `frontend/app/page.tsx` that resets client-side game state (`gameId`, `playerId`, `gameState`, etc.) and clears relevant `localStorage` entries (`gameId`, `playerId`).
        *   Passed `handleReturnToLobby` as a prop to `CheckGameBoard.tsx` and subsequently to `EndOfGameModal.tsx` (via the `useEndModal` hook) to be called by the "Play Again" button.
*   **UI - Main Page (Lobby) Enhancements:**
    *   **Change:** Updated the styling of the main page (when no game is active) in `frontend/app/page.tsx` for a more modern, sleek, and minimal appearance using Tailwind CSS.
    *   **Details:** Improved layout, centering, typography, input field styles, button styles, and the "OR" separator.
*   **Project Font Update:**
    *   **Change:** Replaced the "Inter" font with "Plus Jakarta Sans" across the project for a more unique and modern aesthetic.
    *   **Implementation (`frontend/app/layout.tsx`):**
        *   Imported `Plus_Jakarta_Sans` from `next/font/google`.
        *   Applied its `className` to the `<body>` tag, making it the default font.
        *   Included weights `400, 500, 600, 700` for styling flexibility.
        *   Updated default metadata (title, description).

*Overall, this session involved deep debugging of special ability logic on both client and server, culminating in a critical fix for argument passing on the server, and a separate fix for discard pile ordering to resolve visual inconsistencies.*