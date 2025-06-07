# Frontend Development Guidelines for "Check!"

This document serves as the authoritative guide and source of truth for the frontend development of the "Check!" card game. Its purpose is to ensure consistency, clarity, and adherence to the established architectural and design decisions.

## 1. Core Philosophy & Design System: "Structural Minimalism"

Our aesthetic is inspired by austere, typography-driven editorial design. The experience is not just 'minimal', it is structural, confident in its use of negative space, and relies on a strong grid and typography as the primary design elements.

### 1.1. Visual Identity

-   **Color Palette:** The UI is strictly monochromatic, using a sophisticated off-white/off-black palette. A single vibrant accent color is used extremely sparingly for focus states. All colors are defined as HSL variables in `client/app/globals.css`.

    -   **Light Theme (Default):**
        -   `--background`: A soft, light gray (`hsl(0 0% 98%)`).
        -   `--foreground`: A dark, desaturated gray (`hsl(240 10% 9%)`).
        -   `--muted-foreground`: Lighter gray for secondary text (`hsl(240 3.8% 46.1%)`).
        -   `--border`: Subtle border for dividers/inputs (`hsl(240 5.9% 90%)`).

    -   **Dark Theme:**
        -   `--background`: A rich, near-black (`hsl(0 0% 9%)`).
        -   `--foreground`: Off-white text (`hsl(0 0% 98%)`).
        -   `--muted-foreground`: Lower-contrast gray for secondary text (`hsl(0 0% 63.9%)`).
        -   `--border`: Subtle dark border (`hsl(0 0% 14.9%)`).

    -   **Shared Colors:**
        -   `--primary` (Accent): A vibrant, clean blue (`hsl(200 98% 45%)`). Used almost exclusively for input focus rings.
        -   `--destructive`: A muted, desaturated red (`hsl(0 72% 51%)`).

-   **Typography:** We use `Geist Sans` and `Geist Mono`. Hierarchy is created through size, weight, and layout position, not color.
    -   **Headings:** `Geist Sans`, `font-bold`.
    -   **Body/UI Text:** `Geist Sans`, `font-normal`.
    -   **Labels/IDs:** `Geist Mono`, often decorated with brackets (e.g., `[Info]`).

-   **Iconography:** `lucide-react` is the sole icon library. Icons are used rarely, as typography and layout should carry the design.

-   **Spacing:** Generous and consistent whitespace is mandatory.

### 1.2. Component Design

-   **Cards (`CardDisplay.tsx`):**
    -   **Appearance:** Typographic. A simple `bg-card` surface with a subtle `border`.
    -   **Content:** Rank and Suit are represented by text and simple glyphs.
    -   **Selection State:** Indicated by a `ring-primary` "halo".

-   **Buttons:** UI "chrome" is avoided. Buttons are presented as plain text.
    -   **Style:** Use `variant="ghost"` or `variant="link"`.
    -   **Aesthetic:** Manually add brackets to the button text (e.g., `[Create Game]`) to define them as interactive elements. Do not rely on background colors or heavy borders.

---

## 2. Layout Architecture

The application uses distinct, full-screen layouts for its primary views.

### 2.1. Landing Page (`/`)

-   **Structure:** A vertical Flexbox layout (`flex flex-col min-h-screen`) that treats the entire viewport as a single canvas.
    -   **Header:** A simple, full-width row with the site title on the left and info links on the right.
    -   **Main (`flex-grow`):** The central area, vertically and horizontally centered. Contains the primary user flow (name input, game actions).
    -   **Footer:** A simple, full-width row with secondary links pushed to the corners.

### 2.2. Game Screen (`/game/[gameId]`) - "Player-Centric" Cockpit View

The game screen is structured to prioritize the local player's experience.

-   **`GameScreen` Container:** The root container uses a vertical Flexbox layout (`flex flex-col h-screen`). It is divided into three sections:

    1.  **Opponent Area (Top, `flex-grow`):** Contains `PlayerPod` components for all opponents.
    2.  **Table Area (Middle, `flex-shrink-0`):** A fixed-height container that holds the `Deck` and `DiscardPile`.
    3.  **Local Player Area (Bottom, `flex-shrink-0`):** The primary interaction "cockpit" containing the player's `HandGrid` and contextual `ActionBar`.

-   **`PlayerPod`:** Represents a player's "seat". Displays name, status, and face-down cards.

-   **`SidePanel` (Log & Chat):** A collapsible panel anchored to the side, containing tabs for the Game Log and Chat Box.

---

## 3. State Management & Data Flow

The frontend has a clear, unidirectional data flow.

-   **Zustand (`/store/gameStore.ts`):**
    -   The client-side cache for all data pushed from the server.
    -   Holds `ClientCheckGameState`, game logs, and chat messages.
    -   **Contains the `socketMiddleware`, which encapsulates all `socket.io-client` logic.** The rest of the app is completely decoupled from the raw socket instance.

-   **XState (`/machines/uiMachine.ts`):**
    -   The **brain** of the frontend UI. It orchestrates all user interaction flows, manages complex UI state (e.g., multi-step abilities, selection states), and dictates when to communicate with the server.
    -   It does **not** hold core game state data; it reads that from the Zustand store.

-   **Data Flow (Client -> Server):**
    1.  A UI component (`Button`) sends a simple event to the `uiMachine` (e.g., `DRAW_CLICKED`).
    2.  The `uiMachine` processes this, and if a server action is needed, it emits an `EMIT_TO_SOCKET` event containing the action name and payload.
    3.  The `UIMachineProvider` is listening for these emitted events and calls the `emit` function from the `useGameStore` hook.
    4.  The `socketMiddleware` in the Zustand store executes the actual `socket.emit()`.

-   **Data Flow (Server -> Client):**
    1.  The `socketMiddleware` has listeners (`socket.on(...)`) for server broadcasts like `gameStateUpdate`.
    2.  When an event is received, the middleware's listener directly calls a setter action in the Zustand store (e.g., `setGameState(data)`).
    3.  UI components are subscribed to the Zustand store and re-render automatically when the data changes.

---

## 4. Animation Philosophy

Animations are key to the "flair" in our minimalist design. They must be **subtle, purposeful, and fluid.** We use **Framer Motion** as the exclusive library for all UI motion.

### 4.1. Core Principles

-   **The Primacy of Layout Animation:** This is our most important animation principle. All card movements—from deck to hand, from hand to table, and critically, **from one player's hand to another**—are the lifeblood of the game's visual narrative. These transitions **must** be seamless. They will be achieved using Framer Motion's `layoutId` prop to create a fluid, uninterrupted path for the card, ensuring the player can always track the flow of the game without cognitive load. This is non-negotiable.

-   **Purposeful Motion:** Animation must guide the user's eye, provide clear feedback, and explain state changes in the UI. It should never be decorative for its own sake.

-   **Fluidity and Physics:** Transitions should feel smooth and natural, not jarringly fast. We prefer spring physics (`type: "spring"`) over timed durations for most movements to create a more organic, responsive feel.

### 4.2. Target Implementations & Goals

-   **Card Interactivity (`Tilt Card`):**
    -   **Goal:** Make cards in hand feel like tangible, physical objects under the player's direct control.
    -   **Implementation:** Cards in the `LocalPlayerArea` should have a subtle 3D tilt effect on hover that responds to the cursor's position on the card's surface.

-   **Cursor & Interaction (`Cursor: Magnetic Target`):**
    -   **Goal:** Make the UI feel hyper-responsive and intuitively guide the user towards interactive elements.
    -   **Implementation:** The custom cursor should be "magnetically" pulled towards key interactive elements like buttons and valid drop zones when it is in close proximity.

-   **Rich & Deliberate Feedback (`Radix Tooltip`, `Hold to Confirm`):**
    -   **Goal:** Provide clear, non-intrusive feedback and add psychological weight to important player decisions.
    -   **Implementation:**
        -   Use Framer Motion-animated tooltips (via `radix-ui`) to provide contextual information on hover (e.g., card effects, player names).
        -   Implement a "hold to confirm" interaction for critical, game-defining actions (e.g., playing a final card). The button's UI must visually indicate the hold progress.

-   **Seamless Contextual Transitions (`Modal: Shared Layout`):**
    -   **Goal:** Avoid jarring context shifts when a user requests more information.
    -   **Implementation:** When more detail is needed (e.g., viewing an opponent's stats), the new view or modal must animate out directly from the source element (e.g., the `PlayerPod`) using a shared layout transition.

-   **Engaging States (`Fill Text`, Staggering):**
    -   **Goal:** Make static or waiting periods (like loading) feel active, polished, and on-brand.
    -   **Implementation:**
        -   Use creative typography animations (e.g., "fill text") for loading state messages.
        -   Apply `staggerChildren` to group animations, such as dealing cards, to create a satisfying, cascading effect.

### 4.3. Technical Strategy for Layout Animations

To achieve the "Primacy of Layout Animation," we will adhere to a specific technical implementation:

-   **Global Animation Context:** The entire `GamePage` component will be wrapped in a single Framer Motion `<LayoutGroup>` component. This creates a unified animation context across all areas of the game board (all player hands, the deck, the table), enabling seamless transitions between them.

-   **Unique Card Identity:** Every card, regardless of its location, will be assigned a `motion` component with a `layoutId` prop. This ID must be a unique, persistent string derived from the card's identity (e.g., `card-queen-of-hearts`).

-   **The "Magic Move":** When a card's data moves from one array to another (e.g., from the `deck` array to a `player.hand` array), React will unmount the card component in the old location and mount a new one in the new location. Because both components share the same `layoutId` and exist within the same `<LayoutGroup>`, Framer Motion will automatically generate a smooth "magic move" animation, making the card appear to fly from its old position to its new one.

---

## 5. Development Rules

-   **Styling:** All styling must be done with **Tailwind CSS utility classes** in JSX. No new `.css` files should be created. Use the `cn` utility for conditional classes.
-   **Stateless Components:** Components should be as stateless as possible. UI logic belongs in the `uiMachine`, and server data belongs in the `gameStore`.
-   **Code Location:** Adhere to the existing directory structure (`/components`, `/machines`, `/store`, etc.).
-   **Commitment to the Plan:** All future development must adhere to the principles outlined in this document. 