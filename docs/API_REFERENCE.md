# Socket.IO API Reference

This document details the API for the Check! card game, focusing on the Socket.IO events that form the communication contract between the client and the server. All event names and payloads are defined in the `shared-types` package.

## Client-to-Server Events

These are events that the client emits to the server.

---

### `CREATE_GAME`

*   **Event Name:** `SocketEventName.CREATE_GAME`
*   **Payload:** `InitialPlayerSetupData`
    ```typescript
    interface InitialPlayerSetupData {
      id: string;       // Player's unique ID
      name: string;     // Player's chosen username
      socketId?: string; // Automatically handled by server on join/rejoin
    }
    ```
*   **Description:** Initiates the creation of a new game lobby. The server will generate a unique `gameId`, create a new game machine instance, and have the player join. The server responds via a callback with `{ success: boolean, gameId?: string, playerId?: string, gameState?: ClientCheckGameState }`.

---

### `JOIN_GAME`

*   **Event Name:** `SocketEventName.JOIN_GAME`
*   **Payload:** `(gameIdToJoin: string, playerSetupData: InitialPlayerSetupData, callback)`
*   **Description:** Allows a player to join an existing game lobby using a specific `gameId`. The `playerSetupData` is the same as for `CREATE_GAME`. The server responds via a callback with `{ success: boolean, gameId?: string, playerId?: string, gameState?: ClientCheckGameState }`.

---

### `PLAYER_ACTION`

*   **Event Name:** `SocketEventName.PLAYER_ACTION`
*   **Payload:** A union of all possible player actions, defined by `ConcretePlayerActionEvents`. The `type` property uses the `PlayerActionType` enum.
    ```typescript
    // Example Payload
    {
      type: PlayerActionType.DRAW_FROM_DECK,
      playerId: string
    }
    ```
*   **Description:** This is the primary event for all in-game actions. The server routes this event to the correct game machine instance, which then processes the specific action based on the `type` in the payload. See `PlayerActionType` in `shared-types` for a full list of possible actions (e.g., `DRAW_FROM_DECK`, `CALL_CHECK`, `ATTEMPT_MATCH`, `RESOLVE_SPECIAL_ABILITY`).

---

### `REQUEST_CARD_DETAILS_FOR_ABILITY`

*   **Event Name:** `SocketEventName.REQUEST_CARD_DETAILS_FOR_ABILITY`
*   **Payload:** `RequestCardDetailsPayload`
    ```typescript
    interface RequestCardDetailsPayload {
      targetPlayerId: PlayerId;
      cardIndex: number;
      gameId: string;
    }
    ```
*   **Description:** Used during a special ability (like a King or Queen's peek). The client sends this to request the details of a specific face-down card that belongs to another player. The server responds directly to the requesting socket with the `RESPOND_CARD_DETAILS_FOR_ABILITY` event and also uses a callback for immediate acknowledgment.

---

### `SEND_CHAT_MESSAGE`

*   **Event Name:** `SocketEventName.SEND_CHAT_MESSAGE`
*   **Payload:** `ChatMessage`
    ```typescript
    interface ChatMessage {
      id: string;
      gameId: string;
      senderId: PlayerId;
      senderName: string;
      message: string;
      timestamp: number;
    }
    ```
*   **Description:** Sends a chat message from a client to the server to be broadcast to other players in the same game. The server confirms receipt and validity via a callback: `(ack: {success: boolean, messageId?: string, error?: string}) => void`.

## Server-to-Client Events

These are events that the server emits to clients.

---

### `GAME_STATE_UPDATE`

*   **Event Name:** `SocketEventName.GAME_STATE_UPDATE`
*   **Payload:** `ClientCheckGameState`
*   **Description:** The primary event for broadcasting the game state. The server sends this to all players in a game whenever the state changes. The payload is a redacted version of the full server state, tailored for each receiving player to hide sensitive information (like other players' cards).

---

### `SERVER_LOG_ENTRY`

*   **Event Name:** `SocketEventName.SERVER_LOG_ENTRY`
*   **Payload:** `RichGameLogMessage`
*   **Description:** Sends a structured log message to clients to be displayed in the game log. This is used to inform players about key game events (e.g., "Player X drew a card," "Player Y called Check!"). Some logs may be public (sent to all players) or private (sent to only one player).

---

### `CHAT_MESSAGE`

*   **Event Name:** `SocketEventName.CHAT_MESSAGE`
*   **Payload:** `ChatMessage`
*   **Description:** Broadcasts a chat message received from one client to all other clients in the same game.

---

### `RESPOND_CARD_DETAILS_FOR_ABILITY`

*   **Event Name:** `SocketEventName.RESPOND_CARD_DETAILS_FOR_ABILITY`
*   **Payload:** `RespondCardDetailsPayload`
     ```typescript
    interface RespondCardDetailsPayload {
      card: Card;
      playerId: PlayerId;
      cardIndex: number;
    }
    ```
*   **Description:** Sent in response to a `REQUEST_CARD_DETAILS_FOR_ABILITY` event. This provides a client with the details of a card they were allowed to peek at, allowing the `uiMachine` to proceed with the ability flow.

---

### Error Handling

Instead of a generic `ERROR_MESSAGE` event, the server communicates errors in two primary ways:
1.  **Callback Responses:** Most client-to-server events that expect a response (e.g., `CREATE_GAME`, `JOIN_GAME`, `PLAYER_ACTION`) use a callback function. The first argument to this callback is an object that contains a `success: boolean` field and often a `message: string` field with error details if `success` is `false`.
2.  **Private Log Entries:** For errors that occur outside of a direct request-response flow, the server may send a private `SERVER_LOG_ENTRY` to the specific player who caused or is affected by the error. This allows the client to display the error message in the game log or as a toast notification. 