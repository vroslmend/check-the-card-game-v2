# Frontend Development Guidelines for "Check!"

This document serves as the authoritative guide for the frontend development of the "Check!" card game, ensuring consistency, clarity, and adherence to the established design language.

## 1. Core Philosophy & Design System: "Dynamic Minimalism"

Our aesthetic is **"Dynamic Minimalism"**. It uses a clean, minimalist layout as a canvas for rich, physics-based animations and micro-interactions. The user experience is fluid, responsive, and feels premium.

### 1.1. Visual Identity

-   **Color Palette ("Stone & Zinc"):** The palette is sophisticated and based on a "Stone" (light mode) and "Zinc" (dark mode) theme. All colors are defined as HSL variables in `client/app/globals.css`.

    -   **Light Theme (Default):**
        -   `--background`: `hsl(0 0% 100%)` (Uses `bg-stone-50` in practice)
        -   `--foreground`: `hsl(20 14% 8%)` (Uses `text-stone-900`)
        -   `--muted-foreground`: `hsl(25 5.3% 44.7%)` (Uses `text-stone-600`)
        -   `--border`: `hsl(20 5.9% 90%)`

    -   **Dark Theme:**
        -   `--background`: `hsl(0 0% 3%)` (Uses `dark:bg-zinc-950`)
        -   `--foreground`: `hsl(60 9% 98%)` (Uses `dark:text-stone-100`)
        -   `--muted-foreground`: `hsl(24 5.4% 63.9%)` (Uses `dark:text-stone-400`)
        -   `--border`: `hsl(12 6.5% 15.1%)`

-   **Typography:** The primary font is **`Playfair Display`**, a serif font that provides a sophisticated, editorial feel. The `Inter` sans-serif font is available but should be used sparingly.

    -   **Primary Font:** `Playfair Display` (`font-serif`) is the default for all text.
    -   **Hierarchy:** Established through `font-weight` (e.g., `font-light`), `font-size`, and `letter-spacing` (`tracking-tighter`), not by changing font families.

-   **Iconography:** `lucide-react` is the primary icon library.

### 1.2. Component Design

-   **Buttons:** Buttons are a key part of the premium feel. They are heavily styled with `rounded-full`, background colors, `shadow-xl`, and animated gradient fills on hover. They should almost always be wrapped in the `Magnetic` component to enhance interactivity.

-   **Custom Animated Components:** The UI is built from a suite of bespoke, high-quality components that are central to its identity. These include:
    -   `OptimizedShapes` & `SmoothFloatingElements`: For dynamic, mouse-aware background visuals.
    -   `Scrollytelling` & `CardStack`: For narrative-driven feature sections.
    -   `Signature`: For animated, personal branding.
    -   `Magnetic`: A higher-order component that makes its children magnetically attract the cursor.

### 1.3. Game Interface Components

-   **Container Styling:** Game interfaces should prioritize high contrast and readability:
    -   Use solid white/backgrounds (`bg-white dark:bg-zinc-950`) over gradients for main containers
    -   Apply `rounded-[2.5rem]` and `border border-stone-200 dark:border-zinc-800` for a consistent container style
    -   Use `shadow-2xl` sparingly for primary containers to create depth

-   **Interactive Elements:**
    -   Utilize solid background colors with explicit hover states (e.g., `hover:bg-white dark:hover:bg-zinc-900`)
    -   Add the `data-cursor-link` attribute to all clickable elements for proper cursor behavior
    -   Use the `pointer-events-none` class on icons within buttons to prevent cursor behavior inconsistencies

-   **Game Cards & Player Elements:**
    -   Player rows should use clean, high-contrast backgrounds (`bg-white dark:bg-zinc-900`)
    -   Include subtle hover effects like `y: -4` and shadow changes for interactive elements
    -   Apply animation variants for list items, using staggered entrance animations for related elements

-   **Status Indicators:**
    -   Use bright, distinguishable colors for status indicators (e.g., `text-emerald-500` for success)
    -   Ensure dark mode optimized colors for maximum readability (`dark:text-stone-400` for muted text)
    -   Incorporate subtle animations for active states to enhance user awareness

---

## 2. Layout Architecture

The application uses distinct, full-screen layouts that prioritize a fluid, cinematic user experience.

-   **Layout Structure (`/` and `/game/[gameId]`):** Both layouts utilize a vertical Flexbox structure (`flex flex-col min-h-screen`) to control the primary sections of the view.

-   **Game Screen Structure:** The game screen is a "Player-Centric" cockpit, divided into:
    1.  **Opponent Area (Top, `flex-grow`)**
    2.  **Table Area (Middle, `flex-shrink-0`)**
    3.  **Local Player Area (Bottom, `flex-shrink-0`)**

---

## 3. State Management & Data Flow

The frontend has a clear, unidirectional data flow, managed entirely by XState for in-game logic.

-   **XState (`/machines/uiMachine.ts`):**
    -   The **brain** and **single source of truth** for the client's state **while in a game**.
    -   It manages socket status, holds the `ClientCheckGameState`, and orchestrates complex UI flows.

-   **`UIMachineProvider` (`/components/providers/UIMachineProvider.tsx`):**
    -   The vital link between the `uiMachine`, React, and the Socket.IO server.
    -   It encapsulates all `socket.io-client` logic, keeping the rest of the app decoupled.

-   **Data Flow:**
    -   **Client -> Server:** UI Component -> `uiMachine` Event -> `EMIT_TO_SOCKET` Side-Effect -> `UIMachineProvider` executes `socket.emit()`.
    -   **Server -> Client:** `UIMachineProvider`'s `socket.on()` listener -> `uiMachine` Event -> `uiMachine` updates context -> UI re-renders.

---

## 4. Animation Philosophy

Animations are the lifeblood of the "Dynamic Minimalism" design. They must be **fluid, physics-based, and purposeful.**

### 4.1. Core Principles

-   **Physics-Based Motion:** Use `framer-motion`'s `useSpring` hook for natural, responsive animations.
-   **Scroll-Driven Storytelling:** Use `useScroll` and `useTransform` to create parallax effects and animate content as the user scrolls.
-   **Cursor-Centric Interactivity:** The cursor is an active participant. UI elements should react to its position, and key targets should be "magnetic".
-   **The Primacy of Layout Animation:** All card movements must be seamless, achieved using Framer Motion's `layoutId` prop within a global `<LayoutGroup>`.

### 4.2. Implemented Animations (from `globals.css`)

The following animations are defined and ready for use:

-   **`.animate-float`:** A gentle, continuous up-and-down floating animation.
-   **`.animate-glow`:** A soft, pulsing `box-shadow` effect.
-   **`.text-gradient`:** An animated linear gradient for text.
-   **`.card-hover`:** A smooth lift and scale effect for interactive cards.

### 4.3. Game Interface Animations

-   **Loading States:** Use rotating spinner with `animate={{ rotate: 360 }}` and `transition={{ duration: 2, repeat: Infinity, ease: "linear" }}`
-   **Entrance Animations:** Apply staggered reveals with `custom` prop and variant functions: 
    ```tsx
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } })
    }}
    ```
-   **User Feedback:** Use subtle scale animations for interaction confirmation:
    ```tsx
    animate={copied ? { scale: [1, 1.5, 1] } : {}}
    transition={{ duration: 0.3 }}
    ```
-   **Decorative Elements:** Apply slow, subtle movement to background elements:
    ```tsx
    animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
    ```

---

## 5. Development Rules

-   **Styling:** All styling must be done with **Tailwind CSS utility classes** in JSX.
    -   Use the `cn` utility for conditional classes.
    -   Use custom utilities like `.glass` for a blurred background effect.
-   **Component-First:** Build encapsulated, reusable components. UI logic belongs in the `uiMachine`.
-   **Code Location:** Adhere to the existing directory structure.
-   **Commitment to the Plan:** All future development must adhere to the principles outlined in this document. 