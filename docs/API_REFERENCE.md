# Socket.IO API Reference

This document details the API for the Check! card game, focusing on the Socket.IO events that form the communication contract between the client and the server. All event names and payloads are defined in the `shared-types` package.

## Client-to-Server Events

These are events that the client emits to the server.

---

### `CREATE_GAME`

- **Event Name:** `SocketEventName.CREATE_GAME`
- **Payload:** `InitialPlayerSetupData`
  ```typescript
  interface InitialPlayerSetupData {
    id: string; // Player's unique ID
    name: string; // Player's chosen username
    socketId?: string; // Automatically handled by server on join/rejoin
  }
  ```
- **Description:** Initiates the creation of a new game lobby. The server will generate a unique `gameId`, create a new game machine instance, and have the player join. The server responds via a callback with `{ success: boolean, gameId?: string, playerId?: string, gameState?: ClientCheckGameState }`.

---

### `JOIN_GAME`

- **Event Name:** `SocketEventName.JOIN_GAME`
- **Payload:** `(gameIdToJoin: string, playerSetupData: InitialPlayerSetupData, callback)`
- **Description:** Allows a player to join an existing game lobby using a specific `gameId`. The `playerSetupData` is the same as for `CREATE_GAME`. The server responds via a callback with `{ success: boolean, gameId?: string, playerId?: string, gameState?: ClientCheckGameState }`. The request will fail if the game is not found, is already full, or has already started.

---

### `ATTEMPT_REJOIN`

- **Event Name:** `SocketEventName.ATTEMPT_REJOIN`
- **Payload:** `{ gameId: string, playerId: string }`
- **Description:** Allows a disconnected player to attempt to reconnect to an active game. If successful, the server will re-associate their new socket with their player identity in the game and send them the latest `GAME_STATE_UPDATE`.

---

### `PLAYER_ACTION`

- **Event Name:** `SocketEventName.PLAYER_ACTION`
- **Payload:** A union of all possible player actions, defined by `ConcretePlayerActionEvents`. The `type` property uses the `PlayerActionType` enum.
  ```typescript
  // Example Payload for a match attempt
  {
    type: PlayerActionType.ATTEMPT_MATCH,
    playerId: string,
    payload: {
        cardFromHand: Card;
    }
  }
  ```
- **Description:** This is the primary event for all in-game actions. The server routes this event to the correct game machine instance, which then processes the specific action based on the `type` and `payload`. See `PlayerActionType` in `shared-types` for a full list of possible actions (e.g., `DRAW_FROM_DECK`, `CALL_CHECK`, `ATTEMPT_MATCH`, `DISCARD_FROM_HAND`, `USE_ABILITY`).

---

### `SEND_CHAT_MESSAGE`

- **Event Name:** `SocketEventName.SEND_CHAT_MESSAGE`
- **Payload:** `Omit<ChatMessage, 'id' | 'timestamp'>`
  ```typescript
  // Example Payload
  {
    gameId: string;
    senderId: PlayerId;
    senderName: string;
    message: string;
  }
  ```
- **Description:** Sends a chat message from a client to the server. The server's game machine will add it to the game's chat history and the updated chat log will be sent to all players in the next `GAME_STATE_UPDATE`.

## Server-to-Client Events

These are events that the server emits to clients.

---

### `GAME_STATE_UPDATE`

- **Event Name:** `SocketEventName.GAME_STATE_UPDATE`
- **Payload:** `ClientCheckGameState`
- **Description:** The primary event for broadcasting the game state. The server sends this to all players in a game whenever the state changes. The payload is a redacted version of the full server state, tailored for each receiving player to hide sensitive information (like other players' cards). This event is also sent directly to a player who successfully rejoins a game.

---

### `ABILITY_PEEK_RESULT`

- **Event Name:** `SocketEventName.ABILITY_PEEK_RESULT`
- **Payload:** `{ card: Card, playerId: PlayerId, cardIndex: number }`
- **Description:** Sent directly to a player in response to them using a "peek" ability. This provides the client with the details of a card they were allowed to see, allowing the `uiMachine` to proceed with the ability flow.

---

### Error Handling

Instead of a single, generic `ERROR_MESSAGE` event, the server communicates errors in two primary ways:

1.  **Callback Responses:** Client-to-server events that expect a direct response (e.g., `CREATE_GAME`, `JOIN_GAME`) use a callback function. The first argument to this callback is an object that contains a `success: boolean` field and often a `message: string` field with error details if `success` is `false`. This is used for immediate validation feedback.
2.  **Game State:** Some "errors" or invalid actions are handled directly by the game machine's logic and are reflected in the next `GAME_STATE_UPDATE`. For example, if a player tries to perform an action when it's not their turn, the server won't crash or send a specific error; the game state will simply not change.
