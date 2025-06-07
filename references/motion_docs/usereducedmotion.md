# useReducedMotion

Source: https://motion.dev/docs/react-use-reduced-motion

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

useReducedMotion

# useReducedMotion

A hook that returns `true` if the current device has Reduced Motion setting
enabled.

    
    
    const shouldReduceMotion = useReducedMotion()

This can be used to implement changes to your UI based on Reduced Motion. For
instance, replacing potentially motion-sickness inducing `x`/`y` animations
with `opacity`, disabling the autoplay of background videos, or turning off
parallax motion.

It will actively respond to changes and re-render your components with the
latest setting.

    
    
    export function Sidebar({ isOpen }) {
      const shouldReduceMotion = useReducedMotion()
      const closedX = shouldReduceMotion ? 0 : "-100%"
    
      return (
        <motion.div animate={{
          opacity: isOpen ? 1 : 0,
          x: isOpen ? 0 : closedX
        }} />
      )
    }

## Usage

Import `useReducedMotion` from Motion:

    
    
    import { useReducedMotion } from "motion/react"

In any component, call `useReducedMotion` to check whether the device's
Reduced Motion setting is enabled.

    
    
    const prefersReducedMotion = useReducedMotion()

You can then use this `true`/`false` value to change your application logic.

A hook that returns `true` if the current device has Reduced Motion setting
enabled.

    
    
    const shouldReduceMotion = useReducedMotion()

This can be used to implement changes to your UI based on Reduced Motion. For
instance, replacing potentially motion-sickness inducing `x`/`y` animations
with `opacity`, disabling the autoplay of background videos, or turning off
parallax motion.

It will actively respond to changes and re-render your components with the
latest setting.

    
    
    export function Sidebar({ isOpen }) {
      const shouldReduceMotion = useReducedMotion()
      const closedX = shouldReduceMotion ? 0 : "-100%"
    
      return (
        <motion.div animate={{
          opacity: isOpen ? 1 : 0,
          x: isOpen ? 0 : closedX
        }} />
      )
    }

## Usage

Import `useReducedMotion` from Motion:

    
    
    import { useReducedMotion } from "motion/react"

In any component, call `useReducedMotion` to check whether the device's
Reduced Motion setting is enabled.

    
    
    const prefersReducedMotion = useReducedMotion()

You can then use this `true`/`false` value to change your application logic.

A hook that returns `true` if the current device has Reduced Motion setting
enabled.

    
    
    const shouldReduceMotion = useReducedMotion()

This can be used to implement changes to your UI based on Reduced Motion. For
instance, replacing potentially motion-sickness inducing `x`/`y` animations
with `opacity`, disabling the autoplay of background videos, or turning off
parallax motion.

It will actively respond to changes and re-render your components with the
latest setting.

    
    
    export function Sidebar({ isOpen }) {
      const shouldReduceMotion = useReducedMotion()
      const closedX = shouldReduceMotion ? 0 : "-100%"
    
      return (
        <motion.div animate={{
          opacity: isOpen ? 1 : 0,
          x: isOpen ? 0 : closedX
        }} />
      )
    }

## Usage

Import `useReducedMotion` from Motion:

    
    
    import { useReducedMotion } from "motion/react"

In any component, call `useReducedMotion` to check whether the device's
Reduced Motion setting is enabled.

    
    
    const prefersReducedMotion = useReducedMotion()

You can then use this `true`/`false` value to change your application logic.

[useInView](./react-use-in-view)

[Accessibility](./react-accessibility)

