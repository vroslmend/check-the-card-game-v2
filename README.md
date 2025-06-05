# Check! - Online Multiplayer Card Game

## 🃏 Overview

"Check!" is a web-based, free-to-play online multiplayer card game. The primary goal is to have the lowest total card value in your hand at the end of a round. This project implements the card game with a Node.js/Socket.IO backend and a new, modern Next.js/React frontend.

This README provides a comprehensive guide to understanding, setting up, and running the project. For detailed game rules, refer to `GAME_OVERVIEW.md`. For a chronological log of development changes and specific bug fixes, see `PROJECT_NOTES.md`.

## 🚀 Core Objective of the Game

Be the player with the lowest total card value in your hand when a round ends. Aces are low (-1 point), number cards are face value, and J, Q, K are 11, 12, 13 points respectively.

## ✨ Key Game Mechanics

(Refer to `GAME_OVERVIEW.md` for full details)

*   **Hand Management:** Players manage their cards (initially four) in a conceptual grid, with an initial peek at two of them.
*   **Turn Actions:** Draw from the deck or discard pile, then discard a card by either swapping with a hand card or discarding the drawn card directly.
*   **Matching:** Discarding a card creates an opportunity for any player to match its rank with a card from their hand.
*   **Special Abilities (K, Q, J):** Kings, Queens, and Jacks have unique abilities (peeking at cards, swapping cards) that trigger when discarded or matched as a pair.
*   **"Calling Check":** Players can "Call Check" to signal the final round, or this can occur automatically if a player empties their hand via a match.

## 💻 Technology Stack

This project utilizes a modern technology stack for a robust and interactive experience:

*   **Backend (`server/`):**
    *   Node.js (with native `http` module)
    *   Socket.IO (for WebSocket-based real-time communication)
    *   TypeScript
    *   **XState**: Core game logic, state management, and phase transitions (`game-machine.ts`).
*   **Frontend (`client/` - New Architecture):**
    *   Next.js (latest, using the App Router)
    *   React (latest)
    *   TypeScript
    *   Tailwind CSS (latest, for styling)
    *   **shadcn/ui**: Collection of accessible and customizable UI components, built with Radix UI and Tailwind CSS.
    *   **Zustand**: For managing the global store of server-sent data (`ClientCheckGameState`, game logs, chat messages).
    *   **XState (`@xstate/react`)**: For client-side UI interaction flows, orchestrating complex animation sequences, and managing local UI component states (`AnimationMachine`).
    *   **Framer Motion**: For all animations, especially `layoutId` for smooth card movements and UI transitions.
    *   Socket.IO Client: For real-time communication with the backend.
*   **Shared Code (`shared-types/`):**
    *   TypeScript types, interfaces, and enums utilized by both `client` and `server` to ensure data consistency and type safety. Key types include `ClientCheckGameState`, `GameMachineContext`, `Card` (with a mandatory `id: string`), `PlayerActionType`, etc.
*   **Development Environment:**
    *   npm for package management in each sub-project.
    *   Hot-reloading for both server and client development.

## 📁 Project Structure (Monorepo)

```
check-the-card-game-v2/
├── client/                 # Next.js Frontend Application (New Architecture)
│   ├── app/                # App Router: layouts, pages
│   │   ├── ui/             # Reusable UI elements from shadcn/ui or custom
│   │   └── game/           # Game-specific components (GameBoard, CardComponent, etc.)
│   ├── lib/                # Client-side utility functions, constants
│   ├── hooks/              # Custom React hooks (e.g., useSocketManager)
│   ├── state/              # Client-side state management (Zustand store, XState machines)
│   ├── public/             # Static assets
│   ├── next.config.mjs     # Next.js configuration
│   ├── tailwind.config.ts  # Tailwind CSS configuration
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json        # Dependencies and scripts
├── server/                 # Node.js Socket.IO Game Server
│   ├── src/                # TypeScript source files
│   │   ├── index.ts        # Main server entry point, Socket.IO setup
│   │   └── game-machine.ts # XState machine for core game logic
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json        # Dependencies and scripts
├── shared-types/           # Shared TypeScript Interfaces & Types
│   ├── src/
│   │   └── index.ts        # Main export for shared types
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json        # Dependencies and scripts
├── .gitignore
├── GAME_OVERVIEW.md        # Authoritative game rules and mechanics
├── PROJECT_NOTES.md        # Detailed developer log
├── XSTATE_REFACTOR_PLAN.md # Plan for XState integration (backend & new frontend)
└── README.md               # This file
```

## ✨ Key Architectural Decisions (New Frontend - `client/`)

The new frontend is being rebuilt from scratch to leverage modern state management and animation practices:

*   **Server-Authoritative Game State**: The backend `server/` (specifically its XState `game-machine.ts`) remains the single source of truth for all game logic and state.
*   **Zustand for Server Data**: The `client/` will use a Zustand store to hold the `ClientCheckGameState`, game logs, and chat messages received from the server. This provides an efficient, global, and reactive way for components to access this data.
*   **XState for UI/Animation Orchestration**: A client-side XState machine (referred to as `AnimationMachine`) will manage complex UI interaction sequences (e.g., multi-step abilities) and orchestrate animation sequences. It will *not* duplicate game logic but will react to server state changes and user inputs to manage visual flows.
*   **Framer Motion for All Animations**: All visual animations, especially card movements (using `layoutId`), transitions, and UI effects, will be handled by Framer Motion, driven by states from the `AnimationMachine` and data from the Zustand store.
*   **shadcn/ui for Core UI Components**: Base UI elements (buttons, modals, inputs) will be built using shadcn/ui for speed, consistency, and accessibility, styled with Tailwind CSS.
*   **Component-Driven Design**: Components will be designed to be reactive to the state provided by Zustand and the XState `AnimationMachine`, minimizing local component state for complex logic.

## ⚙️ Setup and Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd check-the-card-game-v2
    ```

2.  **Install All Dependencies:**
    NPM workspaces will handle installing dependencies for `client`, `server`, and `shared-types` simultaneously. From the project root:
    ```bash
    npm install
    ```

3.  **Build All Packages:**
    It's crucial to build `shared-types` first, as both `server` and `client` depend on its output. The root build script handles this order. From the project root:
    ```bash
    npm run build
    ```
    This command will:
    *   Build `shared-types`
    *   Build `server`
    *   Build `client`

4.  **Managing UI Components (shadcn/ui in Frontend):**
    This project uses `shadcn/ui` for its frontend components. The initial setup for `shadcn/ui` is already completed and its configuration is part of the repository.
    If you need to add *new* `shadcn/ui` components during development, navigate to the client directory and use the `shadcn/ui` CLI:
    ```bash
    cd client
    # Example: Add new button and input components
    # npx shadcn@latest add button input
    cd ..
    ```

## ▶️ How to Run the Game

### Development Mode

With the monorepo setup, you can start both the backend server and the frontend development server with a single command from the project root:

1.  **Start Both Server and Client:**
    Ensure all packages have been built at least once (see Setup step 3).
    From the project root (`check-the-card-game-v2/`):
    ```bash
    npm run dev
    ```
    This command uses `concurrently` to:
    *   Start the backend server (equivalent to `cd server && npm start` or `npm run start:server` from root).
    *   Start the Next.js frontend development server (equivalent to `cd client && npm run dev` or `npm run dev:client` from root).

    You should see output from both processes in your terminal.
    *   The server typically starts on `http://localhost:8000`.
    *   The client typically starts on `http://localhost:3000`.

2.  **Access the Game:**
    Open your browser to `http://localhost:3000`.

### Running Services Individually (Optional)

If you need to run the client or server independently (e.g., for focused debugging or after building for production):

*   **Start Only the Backend Server:**
    ```bash
    npm run start:server 
    ```
*   **Start Only the Frontend Development Server:**
    ```bash
    npm run dev:client
    ```
*   **Build Individual Packages:**
    ```bash
    npm run build:shared
    npm run build:server
    npm run build:client
    ```

## 📝 Current Development Status & Focus

*   **Backend Refactor (Completed):** The backend has been successfully refactored to use XState (`game-machine.ts`) for managing all game logic and state. It is considered the authoritative source of truth.
*   **Frontend Rebuild (In Progress):** The frontend is being rebuilt from scratch in the `client/` directory using Next.js, TypeScript, Tailwind CSS, shadcn/ui, Zustand for server state, XState for UI/animation orchestration, and Framer Motion for animations. This aims for a more robust, maintainable, and animated user experience.
*   **`shared-types` (Updated):** Crucial shared types (like `Card.id` becoming mandatory) are being updated to support the new architecture.

## 🔧 Environment Variables

*   **Client (`client/.env.local`):**
    *   `NEXT_PUBLIC_SERVER_URL`: URL for the backend Socket.IO server (defaults to `http://localhost:8000` if not set).
*   **Server (`server/.env`):**
    *   `PORT`: Port for the backend server (defaults to `8000`).

## ☁️ Deployment Considerations

*   The Socket.IO `server/` will likely need hosting on a platform supporting long-running Node.js applications (e.g., Heroku, Render, DigitalOcean, AWS).
*   The Next.js `client/` can be deployed to platforms like Vercel or Netlify, with `NEXT_PUBLIC_SERVER_URL` configured to point to the deployed backend.

## 🎯 Next Steps & Project Roadmap

1.  **Initialize `client/` Project:** Set up the Next.js application with Tailwind and shadcn/ui.
2.  **Update `shared-types`:** Make `Card.id` mandatory and ensure server compatibility.
3.  **Build Core `client/` Infrastructure:**
    *   Implement Socket.IO manager.
    *   Set up Zustand store for server data (`ClientCheckGameState`, logs, chat).
    *   Define and provide the initial client-side XState `AnimationMachine`.
4.  **Develop UI Components:** Re-implement game UI components using shadcn/ui and Tailwind, driven by the new state management.
5.  **Implement Animation Sequences:** Integrate Framer Motion, orchestrated by the `AnimationMachine`, for key interactions (card drawing, playing, etc.).
6.  **Iterative Feature Implementation:** Continue building out all game phases, player actions, and UI feedback according to the `XSTATE_REFACTOR_PLAN.md`.
7.  **Thorough Testing:** Unit, integration, and end-to-end testing for both client and server.

---
Happy Gaming and Coding!