# Development Setup Guide

This guide explains how to set up the Check! card game project for local development, run it, and manage its components.

## ⚙️ Setup and Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd check-the-card-game-v2
    ```

2.  **Install All Dependencies:**
    The project is a monorepo. Installing from the root will install dependencies for `client`, `server`, and `shared-types`.
    ```bash
    npm install
    ```

3.  **Build All Packages:**
    It's crucial to build `shared-types` first, as both `server` and `client` depend on its output. The root build script handles this automatically. From the project root:
    ```bash
    npm run build
    ```
    This command will build all three packages in the correct order.

4.  **Managing UI Components (shadcn/ui):**
    This project uses `shadcn/ui` for its frontend components. The initial setup is already complete. If you need to add *new* `shadcn/ui` components during development, navigate to the client directory and use the `shadcn/ui` CLI:
    ```bash
    cd client
    npx shadcn@latest add button input # Example: adds button and input
    cd ..
    ```

## ▶️ How to Run the Game

The application can be run in two modes: **Development** for active coding and **Production** for the final, optimized version.

### Development Mode (For Coding)

This mode is ideal for development, providing hot-reloading for both the client and server.

1.  **Start Both Server and Client Concurrently:**
    Ensure all packages have been built at least once (see Setup step 3). From the project root (`check-the-card-game-v2/`):
    ```bash
    npm run dev
    ```
    This command uses `concurrently` to start both the backend server and the Next.js frontend development server.
    *   The server typically starts on `http://localhost:8000`.
    *   The client typically starts on `http://localhost:3000`.

2.  **Access the Game:**
    Open your browser and navigate to `http://localhost:3000`.

### Production Mode (For Simulating Deployment)

This mode runs the fully optimized, production-ready version of the application.

1.  **Build the Application:**
    First, ensure you have a complete production build of all packages. From the project root:
    ```bash
    npm run build
    ```

2.  **Start the Production Server:**
    Once the build is complete, start the application with:
    ```bash
    npm start
    ```
    This will launch both the optimized backend server and the production client server.

### Running Services Individually (Optional)

If you need to run the client or server individually (e.g., for focused debugging):

*   **Start Only the Backend Server:**
    ```bash
    npm run start:server
    ```
*   **Start Only the Frontend Development Server:**
    ```bash
    npm run dev:client
    ```

## 🔧 Environment Variables

For local development, it's recommended to create `.env` files in the `server` and `client` directories.

*   **Client (`client/.env.local`):**
    *   `NEXT_PUBLIC_SERVER_URL`: URL for the backend Socket.IO server (defaults to `http://localhost:8000` if not set).

*   **Server (`server/.env`):**
    *   `PORT`: Port for the backend server (defaults to `8000`).
    *   `CORS_ORIGIN`: Allowed origin for CORS (defaults to `http://localhost:3000`).
    *   `PEEK_DURATION_MS`: Duration of initial peek phase in milliseconds (default: `10000`).
    *   `TURN_DURATION_MS`: Duration of a player's turn timer in milliseconds (default: `60000`).
    *   `MATCHING_STAGE_DURATION_MS`: Duration of the matching stage in milliseconds (default: `20000`).
    *   `DISCONNECT_GRACE_PERIOD_MS`: Time before a disconnected player is removed (default: `30000`).
