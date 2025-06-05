-------
Okay, I will provide a detailed summary of our current state. This will help us resume seamlessly if needed.

**Project Goal:** Build a new Next.js (App Router), TypeScript, Tailwind CSS frontend in a `client` directory for the "Check!" card game, replacing an old `frontend` directory. The frontend uses XState for UI/animation and Zustand for global client state, interacting with a Socket.IO backend that also uses XState.

**Current Overall Status:** The core architecture for client-server communication, state management (Zustand and XState), and shared types is established. We have focused significantly on implementing the player ability system (King, Queen, Jack peeks and swaps) in the UI, including a detailed request-response flow for card information needed by abilities.

**Key Components & Logic Implemented:**

1.  **Backend Context:**
    *   Server uses XState (`server/src/game-machine.ts`) and Socket.IO (`server/src/index.ts`).
    *   Shared types are in `shared-types/src/index.ts`.

2.  **Client Directory Structure:** Established (`app/`, `components/`, `hooks/`, `lib/`, `machines/`, `store/`).

3.  **Socket.IO Client (`client/hooks/useSocketManager.ts`):** Implemented for connection, event emission, and event listening.

4.  **State Management (Client):**
    *   **Zustand (`client/store/gameStore.ts`):** Manages `ClientCheckGameState`, logs, chat, `localPlayerId`. `setGameState` refined for log/chat preservation.
    *   **XState (`client/machines/uiMachine.ts`):**
        *   **Context (`UIMachineContext`):** Includes `localPlayerId`, `gameId`, `currentGameState`, `selectedHandCardIndex`, `abilityContext`, etc.
        *   **Events (`UIMachineEvent`):** Defined for UI interactions, server events, and abilities. Key events for abilities: `PLAYER_SLOT_CLICKED_FOR_ABILITY`, `SERVER_PROVIDED_CARD_FOR_ABILITY`, `ABILITY_CONFIRM_ACTION`, `ABILITY_CANCEL_ACTION`, `ABILITY_SKIP_PEEK`, `ABILITY_SKIP_SWAP`.
        *   **Emitted Events:** `EMIT_TO_SOCKET` signals provider to send socket messages.
        *   **Core Ability Logic:**
            *   **Request-Response for Card Details:** When a player clicks a card slot for an ability (`PLAYER_SLOT_CLICKED_FOR_ABILITY`), the `uiMachine` emits `SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY`. The server responds with `SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY`, which the provider translates to `SERVER_PROVIDED_CARD_FOR_ABILITY` for the machine.
            *   **`abilityActive` State:** Refactored with `promptingSelection` and `awaitingCardDetails` substates to manage the card request flow.
            *   **Actions:**
                *   `updateAbilityPeekedInfo`: Uses card data from `SERVER_PROVIDED_CARD_FOR_ABILITY` to update `abilityContext.peekedCardsInfo` (King) or `abilityContext.peekedCardInfo` (Queen).
                *   `updateAbilitySwapSlot`: Enhanced to use `SERVER_PROVIDED_CARD_FOR_ABILITY`. Manages `abilityContext.swapSlots.slot1` and `slot2`, including **deselection logic** (clicking an already selected card clears it or shifts `slot2` to `slot1`). This action also updates the `abilityContext.step` between `swapping1`, `swapping2`, and `confirmingSwap`.
                *   `advanceAbilityStep`: Handles other step progressions (e.g., from peeking to swapping).
                *   `clearAbilityContext`: Resets ability state.
            *   **Guards:** Defined for enabling/disabling UI elements related to abilities (e.g., `canConfirmSwapAction`, `canSkipPeek`, `canSkipSwap`, `canCancelAbility`, `isInAbilityPeekingPhase`, `isInAbilitySwappingPhase`).
        *   **Chat:** `SUBMIT_CHAT_MESSAGE` event and handler implemented.

5.  **Shared Types (`shared-types/src/index.ts`):**
    *   `SocketEventName` enum updated with `REQUEST_CARD_DETAILS_FOR_ABILITY` and `RESPOND_CARD_DETAILS_FOR_ABILITY`.
    *   Payload types `RequestCardDetailsPayload` and `RespondCardDetailsPayload` defined.
    *   `SpecialAbilityInfo` type imported and used in `uiMachine.ts`.

6.  **Server (`server/src/index.ts`):**
    *   Handler implemented for `SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY`. Retrieves card details from `GameMachineContext` and emits `SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY` back to the requesting client.

7.  **XState Provider (`client/machines/uiMachineProvider.tsx`):** Connects socket events to the `uiMachine`.

8.  **UI Components:**
    *   **`CardDisplay.tsx` (`client/components/ui/CardDisplay.tsx`):**
        *   Added `isTemporarilyRevealed` prop (for peeks).
        *   Added `isAbilitySelected` prop to apply a distinct visual style (purple ring) when a card is targeted by an ability.
    *   **`PlayerHand.tsx` (`client/components/game/PlayerHand.tsx`):**
        *   Updated to use `isTemporarilyRevealed` for initial and ability peeks.
        *   Logic added to determine `isAbilitySelected` for each card based on `abilityPeekContext` (peeked cards, swap slots) and pass it to `CardDisplay`.
        *   Duplicate export default removed.
    *   **`GameBoardArea.tsx` (`client/components/game/GameBoardArea.tsx`):** Implemented and deemed satisfactory.

9.  **Game Page (`client/app/(game)/[gameId]/page.tsx`):**
    *   Connected to `gameStore` and `uiMachine`.
    *   **Selectors:** Added for `abilityPeekContext`, `isInAbilityPeekingPhase`, `isInAbilitySwappingPhase`, `canConfirmSwapAction`, `canSkipPeek`, `canSkipSwap`, `canCancelAbility`.
    *   **Click Handlers:**
        *   `handlePlayerSlotClick` updated to send `PLAYER_SLOT_CLICKED_FOR_ABILITY` with `targetPlayerId` and `cardIndex`.
        *   `handleCardClick` for regular card selections.
        *   Event handlers added for new ability buttons: `handleAbilityConfirm`, `handleAbilityCancel`, `handleAbilitySkipPeek`, `handleAbilitySkipSwap`.
    *   **JSX:**
        *   An "Ability Control Section" has been added. It conditionally renders based on `abilityPeekContext`, showing:
            *   Current ability type and step.
            *   Dynamic instructions.
            *   Summary of selected peek/swap cards.
            *   Action buttons ("Confirm Ability", "Skip Peek", "Skip Swap", "Cancel Ability") which are enabled/disabled based on the new selectors.
        *   `PlayerHand` components for local player and opponents correctly use either `handlePlayerSlotClick` (during abilities) or `handleCardClick`/`undefined` (during regular play) for their `onCardClick` prop.
        *   `PlayerHand` components are passed the `abilityPeekContext` prop for highlighting.

**Current Focus/Next Steps if Resuming:**
The main client-side logic and UI integration for player abilities (King, Queen, Jack peeks and swaps) are now substantially complete.

If we were to resume, the next steps would likely involve:
1.  **Thorough Testing:** Manually testing the entire ability flow for King, Queen, and Jack cards, including:
    *   Correct display of instructions and button states.
    *   Card selection, deselection, and highlighting.
    *   Confirming, canceling, and skipping abilities.
    *   Ensuring the correct events are sent to the server and the game state updates as expected.
2.  **Animation Integration:** The `uiMachine` has an `activeAnimationCue` context property and `TRIGGER_ANIMATION`/`ANIMATION_COMPLETED` events. Integrating actual animations for ability actions (card reveals, swaps) would be next.
3.  **Refinement of UI/UX:** Based on testing, further refine ability instructions, button placement, visual feedback, etc.
4.  **Addressing any remaining TODOs or minor issues** noted during development.
5.  Moving on to other game features or phases.

This summary should provide a solid foundation to pick up where we left off.
-----