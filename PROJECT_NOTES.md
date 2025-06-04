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
- Fix the ending result screen.
- Improve the UI and Card Design.
- Better animations.
- Fix inconsistent ui size bug when penalty card is added (placeholder card visual difference)

*Last Updated: 2025-06-03*

---

## Session Notes (YYYY-MM-DD) - XState Game Machine Refactor & Forfeiture Logic

This major refactoring session focused on migrating the core game logic from `game-manager.ts` into a new XState v5 state machine (`server/src/game-machine.ts`). The primary goals were to improve robustness, maintainability, and facilitate better client-side animation control via emitted events.

*   **XState Migration & `emitLogEntry` Replacement:**
    *   The core game logic previously in `game-manager.ts` was successfully transitioned into `server/src/game-machine.ts`.
    *   All direct calls to the temporary `emitLogEntry` function were replaced with XState's `emit()` action creator, using new event types like `EMIT_LOG_PUBLIC` and `EMIT_LOG_PRIVATE`. The temporary `emitLogEntry` function was removed.

*   **Dynamic Player Joining & Game Start:**
    *   A new `awaitingPlayers` state was introduced as the initial state.
    *   Players now join via a `PLAYER_JOIN_REQUEST` event.
    *   Players signal readiness for the initial peek using `DECLARE_READY_FOR_PEEK`.
    *   The game transitions from `awaitingPlayers` to `initialPeekPhase` only when a minimum number of players have joined AND all joined players are ready.
    *   The `CREATE_GAME` event was removed. `GameMachineContext` was updated to initialize `players` and `turnOrder` as empty. `gameMasterId` is set when the first player joins.
    *   Game rules (`docs/GAME_RULES.md`) updated: players can only join before the initial peek phase begins.

*   **Scoring Logic Enhancement:**
    *   The `assign` action in the `scoringPhase` was updated to correctly calculate scores based on `cardValues` (Rule 4).
    *   The `gameover` context object now includes `playerStats` (name, numMatches, numPenalties for each player), which was previously missing.

*   **Automatic "Check" Flow with Abilities (Rule 10.B):**
    *   If an `ATTEMPT_MATCH` leads to an auto-check and requires ability resolution, the machine now correctly transitions to `abilityResolutionPhase` first, then to `finalTurnsPhase`.
    *   The `entry` action of `abilityResolutionPhase` and the `RESOLVE_SPECIAL_ABILITY` action were updated to correctly determine the next phase (e.g., `finalTurnsPhase` if an auto-check occurred, otherwise `playPhase`) when `pendingAbilities` becomes empty.

*   **Forfeiture Logic (`DISCONNECT_GRACE_TIMER_EXPIRED`):**
    *   A simplified two-step process for handling forfeitures was implemented:
        1.  `DISCONNECT_GRACE_TIMER_EXPIRED` action: Marks the player as forfeited (setting `forfeited: true`, `isConnected: false`), clears their pending card, emits a log, broadcasts state, and raises a new internal event `_HANDLE_FORFEITURE_CONSEQUENCES`.
        2.  A new global handler for `_HANDLE_FORFEITURE_CONSEQUENCES` was added to:
            *   Check for game end (if < 2 non-forfeited players, transition to `scoringPhase`).
            *   If the game continues: handle turn/activity skips (clear `currentPlayerId` if it was their turn, remove from `activePlayers` in `matchingStage`, or shift `pendingAbilities` if it was their ability to resolve and re-enter `abilityResolutionPhase`).
            *   Assign changes, emit logs, and broadcast state.

*   **State Cleanup:**
    *   Comprehensive cleanup of transient context fields (`globalAbilityTargets`, `lastRegularSwapInfo`, `matchResolvedDetails`, `lastResolvedAbilityCardForCleanup`, `lastResolvedAbilitySource`, `lastPlayerToResolveAbility`) was implemented.
    *   These fields are now reset to `null` or their default empty states in the `entry` actions of `playPhase.determiningPlayer`, `finalTurnsPhase.determiningFinalTurnPlayer`, and in the `scoringPhase`'s transition to `gameOver`.

*   **Game Rule Verification (Logic in State Machine):**
    *   `discardIsDrawable` Guard (Rule 7.A): Verified to correctly prevent drawing K, Q, J and check for a non-empty, unsealed discard pile.
    *   `discardPileIsSealed` Management (Rule 8): Verified it's set to `true` after successful matches/ability entry and `false` when starting matching opportunities or new turns.
    *   LIFO for Stacked Special Abilities (Rule 9): Verified correct queuing for paired special abilities (`stack`, `stackSecondOfPair`) and proper sorting of `pendingAbilities` in `abilityResolutionPhase` entry (considering `lastPlayerToResolveAbility`).

*Last Updated: 2025-06-04*

## Notes For Reference
Detailed Analysis & Recommendations for Our New client Project:
Now, let's address your questions by synthesizing these findings from "Zhithead" and comparing them to our goals for the new client project.
1. How "Zhithead" Works (and What It Doesn't Do for Multiplayer):
Client-Side Authority: "Zhithead" runs its entire game logic (rules, turns, card states) within a client-side XState machine (zhithead.machine.ts). This machine is the single source of truth for the UI.
UI Driven by State: React components subscribe to this machine's state (via useSelector from the GlobalStateContext) and render accordingly. Animations are triggered by state changes, with Framer Motion handling the visual transitions (often using layoutId for card movements).
Local Multiplayer (Human vs. Bot): It supports a human playing against a bot. The bot logic is an "actor" (createBotService) spawned by the main machine. The humanMachine actor helps manage human input.
No Server Synchronization for Multiplayer Game State: Critically, the "Zhithead" example, as implemented, does not synchronize game state with a server for a human vs. human multiplayer experience. Its zhithead.machine.ts is self-contained on the client. If two players were to run this, they would each have their own independent game.
2. Our Needs for a Multiplayer Game with Synced Animations:
Our "Check!" game is fundamentally multiplayer (human vs. human), and the server (server/src/index.ts with game-machine.ts) is the authoritative source of game state. The frontend's primary role is to:
Send player actions to the server.
Receive game state updates from the server.
Display the game state.
Play animations that reflect the transitions between server-sent states.
3. Frontend State Machine Strategy for Our client:
Given that the server holds the true game state, our frontend XState machine(s) will have a different primary purpose than in "Zhithead".
Option A: One Main Client-Side "Animation & UI Interaction" Machine (Recommended)
Purpose: This machine would not replicate the full game logic from our server's game-machine.ts. Instead, its primary responsibilities would be:
Managing Complex UI Interaction Sequences: For actions that have multiple steps on the client before an event is sent to the server (e.g., selecting multiple cards for a special ability, then confirming).
Orchestrating Multi-Step Animations: For animations that need to happen in a sequence or involve temporary client-side states (e.g., a card briefly "enlarging" on click before an action is chosen, or managing the visual state of a "drag-and-drop" action before it's validated by the server).
Interpreting Server State for Animation: Receiving ClientCheckGameState from the server and translating changes into animation cues or intermediate animation states. For example, if a card moves from deck to player.hand in the server state, this client machine could have states like idle -> animatingDeckToHand -> idle to manage that visual transition smoothly.
Managing Local UI State: Toggles for modals, UI modes not directly tied to game phase (e.g., settings panel), etc.
Context: Its context would hold data relevant to these UI interactions and animation states (e.g., cardBeingDragged, animationTargetCoordinates, selectedCardForAbility). It would not hold the authoritative ClientCheckGameState (that comes from the server and would be stored elsewhere, see point 4).
Interaction with Server State: This machine would receive the latest ClientCheckGameState (e.g., as an event or by reading from a separate store) and use it to inform its transitions or update its own limited context for animation purposes.
Option B: No Main Client-Side Game Logic Machine, Only Small, Focused UI Machines (Less Likely for Complex Animations)
One could try to manage animations primarily with React local state and Framer Motion, perhaps with very small, special-purpose XState machines for specific complex interactions (like a modal flow).
Challenge: For a game with many interdependent animated elements (cards moving between zones, player turns, special abilities), relying solely on React local state can quickly lead back to the "state spaghetti" we're trying to avoid. A central animation orchestrator (Option A) is usually more robust.
Why not replicate server's game-machine.ts on the client?
Redundancy & Conflict: It's complex and error-prone to keep two full game logic machines (client and server) perfectly in sync. The server is the authority.
Unnecessary: The client doesn't need to re-validate all game rules if the server is doing it. Its job is to present the server's state and player actions.
Recommendation: Start with Option A: One Main Client-Side "Animation & UI Interaction" Machine. This machine will be simpler than "Zhithead's" main machine because it offloads game rule authority to our existing backend game-machine.ts.
4. Managing Server-Sent ClientCheckGameState:
The ClientCheckGameState received from the server needs to be stored on the client so that all components can access it.
"Zhithead" Approach (Adapted): In "Zhithead", the main machine's context is the game state. For us, the ClientCheckGameState comes from outside.
Our Approach:
Socket.IO Layer: A dedicated module/hook will manage the Socket.IO connection and receive GAME_STATE_UPDATE events from the server.
Global State Store for ClientCheckGameState: When a new ClientCheckGameState arrives, it should be stored in a way that React components can easily subscribe to it. Options:
React Context + useReducer or useState (at the top level, e.g., in our App.tsx or a layout component): Simplest for just storing and providing the data.
A dedicated simple state management library (like Zustand or Jotai): Can be very efficient for this, offering selectors and reducing boilerplate for updates.
A separate, simple XState machine whose sole job is to hold ClientCheckGameState: Possible, but might be overkill if it's just storing data and not managing complex transitions of that data itself.
Animation Machine Reacts to This Store: Our "Animation & UI Interaction" machine (from point 3) can then:
Either receive the new ClientCheckGameState as an event.
Or, its actions/guards can read from this global store when making decisions or preparing animation data.
Recommendation: For ClientCheckGameState, start with React Context + useState (or useReducer if updates are complex) at a high level. If this becomes unwieldy, then explore Zustand/Jotai. The key is that this store is the "source of truth" for raw game data from the server, and our animation machine uses this data.
5. Achieving Synced Animations in Multiplayer:
Server is Truth: The server dictates the game state. All players receive the same ClientCheckGameState (appropriately view-masked if needed, like for hidden cards).
Client Animation Machine Interprets State Changes: When player A performs an action, the server updates its game-machine.ts, and then broadcasts the new ClientCheckGameState to all players (A, B, C...).
Deterministic Animations: Each client's "Animation & UI Interaction" machine receives this new state. If designed deterministically, it should trigger the same animation sequence on all clients. For example, if ClientCheckGameState shows a card moving from playerA.hand to pile, all clients' animation machines should see this change and initiate their "card from hand to pile" animation sequence.
layoutId is Key: Using layoutId in Framer Motion (as seen in "Zhithead's" Card.tsx) is essential. As long as card IDs are consistent and layoutId is tied to these IDs, Framer Motion will animate the card's position change smoothly when its parent or location in the React tree changes due to the new game state.
No Direct Client-to-Client Animation Sync Needed: You don't typically send "animation events" between clients. Instead, you send authoritative game state changes from the server, and each client independently (but deterministically) renders the animations based on those state changes.
Comparison with Previous Frontend Plan (from XSTATE_REFACTOR_PLAN.md):
Old Plan's Client Machine Context (Section 3.3 in the plan):
cardBeingAnimated: { cardData: ClientCard, sourceElementId: string, targetElementId: string, layoutId: string }
activeDragSource: { cardId: string, originalLocation: string }
currentLayoutAnimations: Map<string, { cardId: string, from: string, to: string}>
Alignment: This old plan is very well aligned with the idea of a dedicated client-side "Animation & UI Interaction" machine (Option A). The context properties listed are exactly the kind of data such a machine would manage to orchestrate animations. The "Zhithead" example reinforces that having an XState machine manage the triggers and parameters for these animations, while Framer Motion does the visual work, is a solid approach.
Summary of Recommendations for New client:
Main Client XState Machine ("Animation & UI Interaction Machine"):
Use createActorContext (like "Zhithead") to provide this machine globally.
Its purpose: manage complex UI flows, orchestrate animation sequences, and hold temporary state related to animations (e.g., cardBeingAnimated).
It reacts to changes in the server-sent ClientCheckGameState.
Define its states, events, context carefully based on the animation sequences you want (e.g., idle, animatingCardMove, awaitingPlayerAbilityTarget).
Storage for ClientCheckGameState:
Store the raw ClientCheckGameState (and game logs, chat messages) received from the server in a separate global store (e.g., React Context with useState/useReducer, or Zustand).
The Animation Machine can read from this store or receive updates from it as events.
Selectors: Create selectors.ts for both the Animation Machine and potentially for the ClientCheckGameState store, so components subscribe only to what they need.
Framer Motion:
Use layoutId extensively on card components, tied to the unique Card.id.
Use AnimatePresence for enter/exit animations.
Let the Animation Machine's state dictate the props for motion components.
Separate Pure UI Logic (lib.ts-like structure): If you have complex UI calculations or formatting that isn't stateful, keep it in utility functions.
Socket.IO Management: Centralize Socket.IO connection and event handling.
By following this, you leverage the strengths of the "Zhithead" example (client-side XState for UI orchestration, Framer Motion for smooth animations, clean provider pattern) while adapting it to our server-authoritative multiplayer architecture. Your client machine won't be a full game engine like Zhithead's, but rather a sophisticated animation and interaction director.
This approach should give you the synced animations you desire because all clients will animate based on the same server-sent state, and their local animation machines will interpret these state changes consistently.

You're asking about three key concepts, two from your existing/previous project (CheckGameBoard, generatePlayerView) and one from shared-types (ClientCheckGameState), and want to understand their equivalents or conceptual parallels in the "Zhithead" example. This is a great way to bridge your understanding.
Let's break them down:
1. ClientCheckGameState (from your shared-types)
Your Project's Need & Functionality:
Need: This is the data structure that represents the state of the "Check!" game as the client needs to see it. It's what the server sends to the client to tell it everything it needs to render the game view.
Functionality: It contains all game elements:
Player information (hands, pending cards, status, scores). Crucially, for other players, hands might be represented as HiddenCard[] or just card counts, while the viewing player sees their actual Card[].
Deck state (e.g., deckSize).
Discard pile state (discardPile: Card[], discardPileIsSealed).
Current game phase (currentPhase), current player (currentPlayerId).
Information about whose turn it is, any pending abilities, gameover data, etc.
It's the "snapshot" of the game from a particular player's perspective.
"Zhithead" Example Equivalent:
ZhitheadContext (within zhithead.machine.ts): This is the closest equivalent. The ZhitheadContext interface defines the structure holding all game state:
Apply to PROJECT_NOTE...
Key Difference: In "Zhithead", this ZhitheadContext is the authoritative game state, managed entirely on the client by zhithead.machine.ts. In your project, ClientCheckGameState is a representation of the server's authoritative state, tailored for client consumption.
Perspective: ZhitheadContext inherently knows everything because it's a local game. Your ClientCheckGameState is what the server decides to show a specific client. For example, ZhitheadContext contains the actual cards for both human.hand and bot.hand. Your ClientCheckGameState would show actual cards for players[localPlayerId].hand but might show HiddenCard[] or counts for other players.
2. generatePlayerView (from your old server/game-manager.ts)
Your Project's Need & Functionality:
Need: Since the server holds the complete game state (including all players' private cards), you need a function to take this complete server state and transform it into the ClientCheckGameState for a specific player. This is crucial for information hiding (e.g., not sending Player B the details of Player A's hand).
Functionality:
Takes the full ServerCheckGameState (or the XState GameMachineContext in your new backend) and a playerId as input.
Constructs a ClientCheckGameState object.
For the given playerId, it includes their actual hand cards.
For other players, it would replace their actual hand cards with HiddenCard objects (just an ID, no rank/suit) or simply a count of cards.
It might also filter or transform other parts of the state if certain information is player-specific.
Essentially, it creates the "player's perspective" of the game state.
"Zhithead" Example Equivalent:
No Direct Equivalent Function: "Zhithead" doesn't strictly need a generatePlayerView function in the same way because:
Client-Side Authority: The ZhitheadContext is the client's view. The "human" player is looking directly at the full game state relevant to them.
Bot Opponent: The "bot" opponent's logic is also client-side. While the UI might visually hide the bot's hand for player experience, the zhithead.machine.ts context still contains the bot's actual cards. UI components rendering the bot's hand would be responsible for displaying them as face-down (e.g., CardComponent with flipped={true}).
Conceptual Parallel in UI Rendering: The effect of generatePlayerView (showing different things to different players) is achieved in "Zhithead" by how its UI components decide to render data. For example:
A HandDisplay component for the "human" would render context.human.hand with cards face up.
A HandDisplay component for the "bot" would render context.bot.hand but tell its CardComponent instances to be flipped={true}.
The "Zhithead" UI itself implements the "player perspective" by selectively showing/hiding or transforming data during rendering, rather than having a dedicated data transformation function before the state even reaches the top-level UI.
3. CheckGameBoard.tsx (from your old frontend/app/components/)
Your Project's Need & Functionality:
Need: A top-level React component responsible for orchestrating and rendering all the different visual parts of the "Check!" game based on the ClientCheckGameState.
Functionality:
Receives ClientCheckGameState and the localPlayerId as props.
Renders player areas (hands, status displays for all players).
Renders shared game areas (deck, discard pile).
Manages UI interactions and dispatches actions to the backend.
Conditionally renders elements based on game phase, current player, etc.
In your old frontend, it also became a hub for a lot of local React state to manage animations, which led to complexity.
"Zhithead" Example Equivalent:
App.tsx (temp/zhithead/src/components/App.tsx): This is the closest equivalent.
It fetches various pieces of state from the GlobalStateContext (which provides the zhitheadMachine actor) using selectors (e.g., isPlaying, isChoosingFaceUpCards).
It lays out the main game areas: the bot's area at the top, human's area at the bottom, and the deck/pile in the middle.
It conditionally renders components like Deck, Pile, ShownHand (for both human and bot), ResultOverlay, TitleScreenOverlay based on the machine's state.
It doesn't directly manage complex animation state itself; rather, it relies on the zhitheadMachine to be the source of truth, and individual components (like Pile.tsx or Card.tsx) use Framer Motion driven by that truth.
Difference in Animation State Management: Your old CheckGameBoard.tsx tried to manage animation state locally. "Zhithead's" App.tsx is simpler in this regard because the animation logic and triggering state are encapsulated within zhithead.machine.ts and the individual animated components respond to that. Our new client's GameBoard component (or its equivalent page route component) will behave more like "Zhithead's" App.tsx, relying on our new client-side AnimationMachine and the GameStateProvider for its data.
In Summary:
| Your Project Concept | "Zhithead" Equivalent/Conceptual Parallel | Key Difference for Our New Client |
| :-------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ClientCheckGameState | ZhitheadContext (in zhithead.machine.ts) | Our ClientCheckGameState is derived from server state and sent to the client. "Zhithead's" context is the client's authoritative state. |
| generatePlayerView | No direct function. Perspective is achieved by UI components selectively rendering/hiding data from the full ZhitheadContext (e.g., rendering bot's cards as flipped). | Our server must have generatePlayerView (or similar logic in game-machine.ts when emitting state) to create the player-specific ClientCheckGameState for multiplayer information hiding. |
| CheckGameBoard.tsx | App.tsx | Our new GameBoard (or equivalent main game view component) will consume state from GameStateProvider (server data) and AnimationMachineProvider (UI/animation state) and be less burdened with local animation state. |
Understanding these parallels and differences is key. "Zhithead" shows excellent patterns for client-side state management with XState and driving Framer Motion animations. We will adapt these patterns to our server-authoritative multiplayer architecture by:
Having our server send ClientCheckGameState (generated with player perspective in mind).
Storing this in our GameStateProvider.
Using a separate client-side AnimationMachine (like "Zhithead's" zhithead.machine.ts in spirit, but for UI/animation, not full game logic) to react to this server state and orchestrate complex animations and UI flows.
Having our main game view component (GameBoard or app/[gameId]/page.tsx) be the layout orchestrator, similar to "Zhithead's" App.tsx.
This approach lets us use the best of both worlds: the robust server-side game logic of "Check!" and the elegant client-side animation and UI state management patterns from "Zhithead."

Yes, absolutely. Based on our discussion, the "Zhithead" example, and the planned architecture for the new `client` project, here are some suggestions for components, including potential changes, renamings, additions, or removals, compared to your old frontend or a typical game structure.

**Guiding Principles for Component Design:**

*   **Driven by State**: Components should primarily react to props derived from `GameStateProvider` (server state) and `AnimationMachineProvider` (client UI/animation state).
*   **Minimal Local State**: Avoid complex local `useState` for logic that can be handled by the `AnimationMachine`. Local state is for purely view-related concerns (e.g., a local hover effect not relevant to game logic).
*   **Clear Responsibilities**: Each component should have a well-defined purpose.
*   **Reusability**: Create generic `ui/` components where possible.
*   **Animation Encapsulation**: Components that animate (like `CardComponent`) should handle their Framer Motion logic, driven by props.

**Suggested Component Structure & Considerations:**

Let's categorize them similarly to the `XSTATE_REFACTOR_PLAN.md` and "Zhithead":

**1. `app/` (Route Components / Page Layouts)**

*   **`app/layout.tsx`**:
    *   **Responsibility**: Root layout, providers.
    *   **Contents**: `<body>`, `GameStateProvider`, `AnimationMachineProvider`, potentially a global `SocketManager` initialization if not done within a provider, global error boundaries, theme provider (if any).
*   **`app/page.tsx` (Home/Lobby Page)**:
    *   **Responsibility**: Display options to create a new game or join an existing game. Handle player name input.
    *   **Components Used**: `components/ui/Input`, `components/ui/Button`, `components/ui/Modal` (perhaps for join game input).
    *   **State Interaction**: Dispatches events like `CREATE_GAME_REQUESTED_BY_UI({ playerName })` or `JOIN_GAME_REQUESTED_BY_UI({ gameId, playerName })` to the `AnimationMachine`. Listens to `AnimationMachine` state for loading/error states.
*   **`app/[gameId]/page.tsx` (Main Game Page)**:
    *   **Responsibility**: The primary view when a player is in a game. Orchestrates the overall game layout.
    *   **Name**: Could also be `app/game/[gameId]/page.tsx` if you want to group game-related routes.
    *   **Components Used**: `components/game/GameBoard`, `components/game/ChatWindow`, `components/game/GameLogDisplay`, `components/ui/SettingsButton` (or similar).
    *   **State Interaction**:
        *   Gets `gameId` from route params.
        *   Sends `ENTERED_GAME_ROOM({ gameId })` to `AnimationMachine` on load (if needed for machine to fetch initial state or join a socket room).
        *   Primarily acts as a container, passing necessary state down to `GameBoard`.
*   **`app/loading.tsx` / `app/error.tsx` (Next.js special files)**:
    *   Standard Next.js files for handling loading states during route transitions and error display.

**2. `components/ui/` (Generic, Reusable UI Elements)**

*   **`Button.tsx`**: Standard button, variants for primary, secondary, danger.
*   **`Input.tsx`**: Styled text input.
*   **`Modal.tsx`**: Reusable modal component (for game over, settings, special ability choices if generic enough).
*   **`CardPlaceholder.tsx`**: (New) A simple visual placeholder for where cards would be (e.g., an empty hand slot). Can be used by `PlayerHandDisplay` or `DiscardPileArea` when empty.
*   **`Spinner.tsx`**: Loading spinner.
*   **`Tooltip.tsx`**: For hover information.
*   **`Icon.tsx`**: Wrapper for SVG icons (e.g., from Lucide Icons, like in "Zhithead").
*   **`PlayerAvatar.tsx`**: (Optional) If you have player avatars or icons beyond just names.

**3. `components/game/` (Game-Specific Components)**

*   **`GameBoard.tsx`**:
    *   **Responsibility**: Main layout area for all interactive game elements.
    *   **Replaces**: Acts as the core of your old `CheckGameBoard.tsx` but with less direct state management.
    *   **Components Used**: `PlayerDisplayArea` (for each player), `SharedGameArea` (deck, discard), `TurnIndicator`, `GamePhaseDisplay`.
    *   **State Interaction**: Consumes `ClientCheckGameState` and `AnimationMachine` state to position and conditionally render its children.
*   **`PlayerDisplayArea.tsx`**: (New or Refined `PlayerStatusDisplay`)
    *   **Responsibility**: Container for everything related to a single player's visible area (their hand, status, score, pending card display).
    *   **Props**: `playerId`, `isLocalPlayer`.
    *   **Components Used**: `PlayerHandDisplay`, `PlayerStatus`, `PendingCardDisplay`.
*   **`PlayerHandDisplay.tsx`**:
    *   **Responsibility**: Renders a player's hand of cards.
    *   **Props**: `playerId`, `cards: ClientCard[]`, `isLocalPlayer`, `onCardClick` (which might send event to `AnimationMachine`), `interactionHints` (from `AnimationMachine`, e.g., which cards are selectable).
    *   **Components Used**: `CardComponent`, `CardPlaceholder`.
*   **`CardComponent.tsx`**:
    *   **Responsibility**: Renders a single card, handles its individual animation properties.
    *   **Key Feature**: `layoutId={card.id}`.
    *   **Props**: `card: ClientCard | null`, `isFaceUp` (determined by game logic and whether it's local player's hidden card), `onClick`, `isSelected`, `isTargeted`, `isBeingDragged`, `animationVariant` (from `AnimationMachine` to trigger specific animations like "wiggle", "glow").
*   **`SharedGameArea.tsx`**: (New)
    *   **Responsibility**: Container for deck and discard pile.
    *   **Components Used**: `DeckDisplay`, `DiscardPileDisplay`.
*   **`DeckDisplay.tsx`**:
    *   **Responsibility**: Renders the draw pile.
    *   **Props**: `deckSize: number`, `onDrawClick` (sends event to `AnimationMachine`).
    *   **Animation**: Shows card animating out (driven by `AnimationMachine` context like `cardAnimatingFromDeck`).
    *   **Components Used**: `CardComponent` (styled as a deck, possibly showing top card if rules allow, or just a card back).
*   **`DiscardPileDisplay.tsx`**:
    *   **Responsibility**: Renders the discard pile.
    *   **Props**: `topCards: Card[]` (might show a few top cards if needed for visuals, or just the very top), `pileSize: number`, `isSealed`, `onDrawClick` (if drawing from discard is allowed, sends event to `AnimationMachine`).
    *   **Animation**: Shows card animating in/out.
    *   **Components Used**: `CardComponent`.
*   **`PendingCardDisplay.tsx`**: (Could be part of `PlayerDisplayArea`)
    *   **Responsibility**: Displays the card a player has drawn but not yet placed (your `pendingDrawnCard`).
    *   **Props**: `card: ClientCard | null`, `source: 'deck' | 'discard' | null`.
    *   **Animation**: Card animates into this area, then from this area to hand or discard.
    *   **Components Used**: `CardComponent`.
*   **`PlayerStatus.tsx`**:
    *   **Responsibility**: Shows player name, score, number of cards, current turn status, disconnected status, "CHECK!" status.
    *   **Props**: `playerName`, `score`, `cardCount`, `isCurrentTurn`, `isActivePlayerForMatching`, `playerActivityStatus`, `isForfeited`.
*   **`TurnIndicator.tsx`**:
    *   **Responsibility**: Visually indicates whose turn it is or current game phase.
    *   **Props**: `currentPlayerName`, `currentPhaseName`, `timerRemaining` (if you add visual timers driven by server).
*   **`GamePhaseDisplay.tsx`**: (Could be part of `TurnIndicator` or `GameBoard`)
    *   **Responsibility**: Displays the current `GamePhase` (e.g., "Play Phase", "Matching Stage").
*   **`GameLogDisplay.tsx`**:
    *   **Responsibility**: Shows the list of `RichGameLogMessage`s.
    *   **Props**: `logs: RichGameLogMessage[]`.
    *   **Features**: Auto-scroll.
*   **`ChatWindow.tsx`**:
    *   **Responsibility**: Displays chat messages and allows sending new ones.
    *   **Props**: `messages: ChatMessage[]`, `onSendMessage` (sends event to `AnimationMachine` or directly via `SocketManager`).
*   **`AbilityChoiceModal.tsx`**: (Or inline UI elements)
    *   **Responsibility**: UI for when a player needs to make a choice for a special ability (e.g., target player for King, choose card for Jack).
    *   **State Interaction**: Driven by `AnimationMachine` state (e.g., `awaitingAbilityInput`). Sends choice back to `AnimationMachine`.
*   **`GameOverDisplay.tsx`**:
    *   **Responsibility**: Modal or full-screen overlay showing game results.
    *   **Props**: `gameOverData: GameOverData`.
    *   **State Interaction**: Shown when `AnimationMachine` is in a `gameOver` state.

**Potential Removals/Merges (from a generic "old frontend" perspective):**

*   If you had many small components that were purely for managing bits of local animation state, those can likely be removed or simplified, as the `AnimationMachine` and Framer Motion's `layoutId` will handle much of that.
*   Your old `CheckGameBoard.tsx`'s direct responsibilities will be split: layout to the new `GameBoard.tsx` (or `app/[gameId]/page.tsx`), animation orchestration to `AnimationMachine`, and game state data from `GameStateProvider`.

**Key Additions/Focus Areas:**

*   **`AnimationMachineProvider` and `GameStateProvider`**: Central to the new architecture.
*   **Clearer separation between `ui/` and `game/` components.**
*   **`PlayerDisplayArea.tsx`**: A good container to group player-specific UI.
*   **Emphasis on `CardComponent` with `layoutId`**: This will be the workhorse for card animations.
*   **Components driven by selectors** from the providers.

This component structure is a suggestion and can be adapted. The main idea is to have components that are well-scoped, reactive to the centralized state (server game state and client animation state), and delegate complex animation transitions to Framer Motion, orchestrated by the `AnimationMachine`.

What do you think of this proposed component structure? Does it feel like a good fit for the new `client`?
