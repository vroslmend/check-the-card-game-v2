# useAnimate

Source: https://motion.dev/docs/react-use-animate

## JS

## React

Vue

### [Examples](https://examples.motion.dev/react)### [Get started](./react-
quick-start)### [Courses](./react-courses)

### Animation

  * [Overview](./react-animation)

  * [Gestures](./react-gestures)

  * [Layout](./react-layout-animations)

  * [Scroll](./react-scroll-animations)

  * [Transitions](./react-transitions)

### Components

  * [motion](./react-motion-component)

  * [AnimatePresence](./react-animate-presence)

  * [LayoutGroup](./react-layout-group)

  * [LazyMotion](./react-lazy-motion)

  * [MotionConfig](./react-motion-config)

  * [Reorder](./react-reorder)

### Motion+

[Learn more](../plus)

  * [AnimateNumber](./react-animate-number)

  * [Cursor](./cursor)

  * [Ticker](./react-ticker)

### Motion values

  * [Overview](./react-motion-value)

  * [useMotionTemplate](./react-use-motion-template)

  * [useMotionValueEvent](./react-use-motion-value-event)

  * [useScroll](./react-use-scroll)

  * [useSpring](./react-use-spring)

  * [useTime](./react-use-time)

  * [useTransform](./react-use-transform)

  * [useVelocity](./react-use-velocity)

### Hooks

  * [useAnimate](./react-use-animate)

  * [useAnimationFrame](./react-use-animation-frame)

  * [useDragControls](./react-use-drag-controls)

  * [useInView](./react-use-in-view)

  * [useReducedMotion](./react-use-reduced-motion)

### Integrations

  * [Framer](./framer)

  * [Figma](./figma)

  * [Radix](./radix)

### Guides

  * [Upgrade guide](./react-upgrade-guide)

  * [Accessibility](./react-accessibility)

  * [Reduce bundle size](./react-reduce-bundle-size)

## JS

## React

Vue

### [Examples](https://examples.motion.dev/react)### [Get started](./react-
quick-start)### [Courses](./react-courses)

### Animation

  * [Overview](./react-animation)

  * [Gestures](./react-gestures)

  * [Layout](./react-layout-animations)

  * [Scroll](./react-scroll-animations)

  * [Transitions](./react-transitions)

### Components

  * [motion](./react-motion-component)

  * [AnimatePresence](./react-animate-presence)

  * [LayoutGroup](./react-layout-group)

  * [LazyMotion](./react-lazy-motion)

  * [MotionConfig](./react-motion-config)

  * [Reorder](./react-reorder)

### Motion+

[Learn more](../plus)

  * [AnimateNumber](./react-animate-number)

  * [Cursor](./cursor)

  * [Ticker](./react-ticker)

### Motion values

  * [Overview](./react-motion-value)

  * [useMotionTemplate](./react-use-motion-template)

  * [useMotionValueEvent](./react-use-motion-value-event)

  * [useScroll](./react-use-scroll)

  * [useSpring](./react-use-spring)

  * [useTime](./react-use-time)

  * [useTransform](./react-use-transform)

  * [useVelocity](./react-use-velocity)

### Hooks

  * [useAnimate](./react-use-animate)

  * [useAnimationFrame](./react-use-animation-frame)

  * [useDragControls](./react-use-drag-controls)

  * [useInView](./react-use-in-view)

  * [useReducedMotion](./react-use-reduced-motion)

### Integrations

  * [Framer](./framer)

  * [Figma](./figma)

  * [Radix](./radix)

### Guides

  * [Upgrade guide](./react-upgrade-guide)

  * [Accessibility](./react-accessibility)

  * [Reduce bundle size](./react-reduce-bundle-size)

React

useAnimate

# useAnimate

`useAnimate` provides a way of using the `[animate](./animate)`[
function](./animate) that is scoped to the elements within your component.

This allows you to use manual animation controls, timelines, selectors scoped
to your component, and automatic cleanup.

It provides a `scope` ref, and an `animate` function where every DOM selector
is scoped to this ref.

    
    
    function Component() {
      const [scope, animate] = useAnimate()
    
      useEffect(() => {
        // This "li" selector will only select children
        // of the element that receives `scope`.
        animate("li", { opacity: 1 })
      })
      
      return <ul ref={scope}>{children}</ul>
    }

Additionally, when the component calling `useAnimate` is removed, all
animations started with its `animate` function will be cleaned up
automatically.

## Usage

Import from Motion:

    
    
    // Mini
    import { useAnimate } from "motion/react-mini"
    
    // Hybrid
    import { useAnimate } from "motion/react"

`useAnimate` returns two arguments, a `scope` ref and an
`[animate](./animate)`[ function](./animate).

    
    
    function Component() {
      const [scope, animate] = useAnimate()

This `scope` ref must be passed to either a regular HTML/SVG element or a
`motion` component.

    
    
    function Component({ children }) {
      const [scope, animate] = useAnimate()
      
      return <ul ref={scope}>{children}</ul>
    }

This scoped `animate` function can now be used in effects and event handlers
to animate elements.

We can either use the scoped element directly:

    
    
    animate(scope.current, { opacity: 1 }, { duration: 1 })

Or by passing it a selector:

    
    
    animate("li", { backgroundColor: "#000" }, { ease: "linear" })

This selector is `"li"`, but we're not selecting all `li` elements on the
page, only those that are a child of the scoped element.

### Scroll-triggered animations

Animations can be triggered when the scope scrolls into view by combining
`useAnimate` with `[useInView](./react-use-in-view)`.

    
    
    import { useAnimate, useInView } from "motion/react"
    
    function Component() {
      const [scope, animate] = useAnimate()
      const isInView = useInView(scope)
      
      useEffect(() => {
         if (isInView) {
           animate(scope.current, { opacity: 1 })
         }
      }, [isInView])
      
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

### Exit animations

It's possible to compose your own exit animations when a component is removed
using `useAnimate` in conjunction with `[usePresence](./react-animate-
presence)`.

    
    
    import { useAnimate, usePresence } from "framer-motion"
    
    function Component() {
      const [isPresent, safeToRemove] = usePresence()
      const [scope, animate] = useAnimate()
      
      useEffect(() => {
         if (isPresent) {
           const enterAnimation = async () => {
             await animate(scope.current, { opacity: 1 })
             await animate("li", { opacity: 1, x: 0 })
           }
           enterAnimation()
    
         } else {
           const exitAnimation = async () => {
             await animate("li", { opacity: 0, x: -100 })
             await animate(scope.current, { opacity: 0 })
             safeToRemove()
           }
           
           exitAnimation()
         }
      }, [isPresent])
      
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

This component can now be conditionally rendered as a child of
`AnimatePresence`.

    
    
    <AnimatePresence>
      {show ? <Component key="dialog" /> : null}
    </AnimatePresence>

`useAnimate` provides a way of using the `[animate](./animate)`[
function](./animate) that is scoped to the elements within your component.

This allows you to use manual animation controls, timelines, selectors scoped
to your component, and automatic cleanup.

It provides a `scope` ref, and an `animate` function where every DOM selector
is scoped to this ref.

    
    
    function Component() {
      const [scope, animate] = useAnimate()
    
      useEffect(() => {
        // This "li" selector will only select children
        // of the element that receives `scope`.
        animate("li", { opacity: 1 })
      })
      
      return <ul ref={scope}>{children}</ul>
    }

Additionally, when the component calling `useAnimate` is removed, all
animations started with its `animate` function will be cleaned up
automatically.

## Usage

Import from Motion:

    
    
    // Mini
    import { useAnimate } from "motion/react-mini"
    
    // Hybrid
    import { useAnimate } from "motion/react"

`useAnimate` returns two arguments, a `scope` ref and an
`[animate](./animate)`[ function](./animate).

    
    
    function Component() {
      const [scope, animate] = useAnimate()

This `scope` ref must be passed to either a regular HTML/SVG element or a
`motion` component.

    
    
    function Component({ children }) {
      const [scope, animate] = useAnimate()
      
      return <ul ref={scope}>{children}</ul>
    }

This scoped `animate` function can now be used in effects and event handlers
to animate elements.

We can either use the scoped element directly:

    
    
    animate(scope.current, { opacity: 1 }, { duration: 1 })

Or by passing it a selector:

    
    
    animate("li", { backgroundColor: "#000" }, { ease: "linear" })

This selector is `"li"`, but we're not selecting all `li` elements on the
page, only those that are a child of the scoped element.

### Scroll-triggered animations

Animations can be triggered when the scope scrolls into view by combining
`useAnimate` with `[useInView](./react-use-in-view)`.

    
    
    import { useAnimate, useInView } from "motion/react"
    
    function Component() {
      const [scope, animate] = useAnimate()
      const isInView = useInView(scope)
      
      useEffect(() => {
         if (isInView) {
           animate(scope.current, { opacity: 1 })
         }
      }, [isInView])
      
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

### Exit animations

It's possible to compose your own exit animations when a component is removed
using `useAnimate` in conjunction with `[usePresence](./react-animate-
presence)`.

    
    
    import { useAnimate, usePresence } from "framer-motion"
    
    function Component() {
      const [isPresent, safeToRemove] = usePresence()
      const [scope, animate] = useAnimate()
      
      useEffect(() => {
         if (isPresent) {
           const enterAnimation = async () => {
             await animate(scope.current, { opacity: 1 })
             await animate("li", { opacity: 1, x: 0 })
           }
           enterAnimation()
    
         } else {
           const exitAnimation = async () => {
             await animate("li", { opacity: 0, x: -100 })
             await animate(scope.current, { opacity: 0 })
             safeToRemove()
           }
           
           exitAnimation()
         }
      }, [isPresent])
      
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

This component can now be conditionally rendered as a child of
`AnimatePresence`.

    
    
    <AnimatePresence>
      {show ? <Component key="dialog" /> : null}
    </AnimatePresence>

`useAnimate` provides a way of using the `[animate](./animate)`[
function](./animate) that is scoped to the elements within your component.

This allows you to use manual animation controls, timelines, selectors scoped
to your component, and automatic cleanup.

It provides a `scope` ref, and an `animate` function where every DOM selector
is scoped to this ref.

    
    
    function Component() {
      const [scope, animate] = useAnimate()
    
      useEffect(() => {
        // This "li" selector will only select children
        // of the element that receives `scope`.
        animate("li", { opacity: 1 })
      })
      
      return <ul ref={scope}>{children}</ul>
    }

Additionally, when the component calling `useAnimate` is removed, all
animations started with its `animate` function will be cleaned up
automatically.

## Usage

Import from Motion:

    
    
    // Mini
    import { useAnimate } from "motion/react-mini"
    
    // Hybrid
    import { useAnimate } from "motion/react"

`useAnimate` returns two arguments, a `scope` ref and an
`[animate](./animate)`[ function](./animate).

    
    
    function Component() {
      const [scope, animate] = useAnimate()

This `scope` ref must be passed to either a regular HTML/SVG element or a
`motion` component.

    
    
    function Component({ children }) {
      const [scope, animate] = useAnimate()
      
      return <ul ref={scope}>{children}</ul>
    }

This scoped `animate` function can now be used in effects and event handlers
to animate elements.

We can either use the scoped element directly:

    
    
    animate(scope.current, { opacity: 1 }, { duration: 1 })

Or by passing it a selector:

    
    
    animate("li", { backgroundColor: "#000" }, { ease: "linear" })

This selector is `"li"`, but we're not selecting all `li` elements on the
page, only those that are a child of the scoped element.

### Scroll-triggered animations

Animations can be triggered when the scope scrolls into view by combining
`useAnimate` with `[useInView](./react-use-in-view)`.

    
    
    import { useAnimate, useInView } from "motion/react"
    
    function Component() {
      const [scope, animate] = useAnimate()
      const isInView = useInView(scope)
      
      useEffect(() => {
         if (isInView) {
           animate(scope.current, { opacity: 1 })
         }
      }, [isInView])
      
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

### Exit animations

It's possible to compose your own exit animations when a component is removed
using `useAnimate` in conjunction with `[usePresence](./react-animate-
presence)`.

    
    
    import { useAnimate, usePresence } from "framer-motion"
    
    function Component() {
      const [isPresent, safeToRemove] = usePresence()
      const [scope, animate] = useAnimate()
      
      useEffect(() => {
         if (isPresent) {
           const enterAnimation = async () => {
             await animate(scope.current, { opacity: 1 })
             await animate("li", { opacity: 1, x: 0 })
           }
           enterAnimation()
    
         } else {
           const exitAnimation = async () => {
             await animate("li", { opacity: 0, x: -100 })
             await animate(scope.current, { opacity: 0 })
             safeToRemove()
           }
           
           exitAnimation()
         }
      }, [isPresent])
      
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

This component can now be conditionally rendered as a child of
`AnimatePresence`.

    
    
    <AnimatePresence>
      {show ? <Component key="dialog" /> : null}
    </AnimatePresence>

[Upgrade guide](./react-upgrade-guide)

[useAnimationFrame](./react-use-animation-frame)

