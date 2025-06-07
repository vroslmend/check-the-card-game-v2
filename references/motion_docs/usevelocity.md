# useVelocity

Source: https://motion.dev/docs/react-use-velocity

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

useVelocity

# useVelocity

`useVelocity` accepts a [motion value](./react-motion-value) and returns a new
one that updates with the provided motion value's velocity.

    
    
    const x = useMotionValue(0)
    const xVelocity = useVelocity(x)
    const scale = useTransform(
      xVelocity,
      [-3000, 0, 3000],
      [2, 1, 2],
      { clamp: false }
    )
    
    return <motion.div drag="x" style={{ x, scale }} />

## Usage

Import `useVelocity` from Motion:

    
    
    import { useVelocity } from "motion/react"

Pass any numerical motion value to `useVelocity`. It'll return a new motion
value that updates with the velocity of the original value.

    
    
    import { useMotionValue, useVelocity } from "framer-motion"
    
    function Component() {
      const x = useMotionValue(0)
      const xVelocity = useVelocity(x)
    
      useMotionValueEvent(xVelocity, "change", latest => {
        console.log("Velocity", latestVelocity)
      })
      
      return <motion.div style={{ x }} />
    }

Any numerical motion value will work. Even one returned from `useVelocity`.

    
    
    const x = useMotionValue(0)
    const xVelocity = useVelocity(x)
    const xAcceleration = useVelocity(xVelocity)

`useVelocity` accepts a [motion value](./react-motion-value) and returns a new
one that updates with the provided motion value's velocity.

    
    
    const x = useMotionValue(0)
    const xVelocity = useVelocity(x)
    const scale = useTransform(
      xVelocity,
      [-3000, 0, 3000],
      [2, 1, 2],
      { clamp: false }
    )
    
    return <motion.div drag="x" style={{ x, scale }} />

## Usage

Import `useVelocity` from Motion:

    
    
    import { useVelocity } from "motion/react"

Pass any numerical motion value to `useVelocity`. It'll return a new motion
value that updates with the velocity of the original value.

    
    
    import { useMotionValue, useVelocity } from "framer-motion"
    
    function Component() {
      const x = useMotionValue(0)
      const xVelocity = useVelocity(x)
    
      useMotionValueEvent(xVelocity, "change", latest => {
        console.log("Velocity", latestVelocity)
      })
      
      return <motion.div style={{ x }} />
    }

Any numerical motion value will work. Even one returned from `useVelocity`.

    
    
    const x = useMotionValue(0)
    const xVelocity = useVelocity(x)
    const xAcceleration = useVelocity(xVelocity)

`useVelocity` accepts a [motion value](./react-motion-value) and returns a new
one that updates with the provided motion value's velocity.

    
    
    const x = useMotionValue(0)
    const xVelocity = useVelocity(x)
    const scale = useTransform(
      xVelocity,
      [-3000, 0, 3000],
      [2, 1, 2],
      { clamp: false }
    )
    
    return <motion.div drag="x" style={{ x, scale }} />

## Usage

Import `useVelocity` from Motion:

    
    
    import { useVelocity } from "motion/react"

Pass any numerical motion value to `useVelocity`. It'll return a new motion
value that updates with the velocity of the original value.

    
    
    import { useMotionValue, useVelocity } from "framer-motion"
    
    function Component() {
      const x = useMotionValue(0)
      const xVelocity = useVelocity(x)
    
      useMotionValueEvent(xVelocity, "change", latest => {
        console.log("Velocity", latestVelocity)
      })
      
      return <motion.div style={{ x }} />
    }

Any numerical motion value will work. Even one returned from `useVelocity`.

    
    
    const x = useMotionValue(0)
    const xVelocity = useVelocity(x)
    const xAcceleration = useVelocity(xVelocity)

useVelocity

Examples

## Go beyond the basics

[Motion+](../plus) is a one-time fee, lifetime membership.

As well as premium Motion features, early access content, and a private
Discord community, you'll unlock access to the source code of 90+ premium
examples that take the APIs on this page to the next level.

Loading...

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[useTransform](./react-use-transform)

[Motion for React Three Fiber](./react-three-fiber)

