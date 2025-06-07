# useTime

Source: https://motion.dev/docs/react-use-time

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

useTime

# useTime

`useTime` returns a [motion value](./react-motion-value) that updates once per
frame with the duration, in milliseconds, since it was first created.

This is especially useful in generating perpetual animations.

    
    
    const time = useTime();
    const rotate = useTransform(time, [0, 4000], [0, 360], { clamp: false });
    
    return <motion.div style={{ rotate }} />

## Usage

Import from Motion:

    
    
    import { useTime } from "motion/react"

When called, `useTime` will create a new motion value. This value will update
every frame with the time since its creation.

You can use this either directly or by composing with other motion value
hooks.

    
    
    const time = useTime()
    const rotate = useTransform(
      time,
      [0, 4000], // For every 4 seconds...
      [0, 360], // ...rotate 360deg
      { clamp: false }
    )

`useTime` returns a [motion value](./react-motion-value) that updates once per
frame with the duration, in milliseconds, since it was first created.

This is especially useful in generating perpetual animations.

    
    
    const time = useTime();
    const rotate = useTransform(time, [0, 4000], [0, 360], { clamp: false });
    
    return <motion.div style={{ rotate }} />

## Usage

Import from Motion:

    
    
    import { useTime } from "motion/react"

When called, `useTime` will create a new motion value. This value will update
every frame with the time since its creation.

You can use this either directly or by composing with other motion value
hooks.

    
    
    const time = useTime()
    const rotate = useTransform(
      time,
      [0, 4000], // For every 4 seconds...
      [0, 360], // ...rotate 360deg
      { clamp: false }
    )

`useTime` returns a [motion value](./react-motion-value) that updates once per
frame with the duration, in milliseconds, since it was first created.

This is especially useful in generating perpetual animations.

    
    
    const time = useTime();
    const rotate = useTransform(time, [0, 4000], [0, 360], { clamp: false });
    
    return <motion.div style={{ rotate }} />

## Usage

Import from Motion:

    
    
    import { useTime } from "motion/react"

When called, `useTime` will create a new motion value. This value will update
every frame with the time since its creation.

You can use this either directly or by composing with other motion value
hooks.

    
    
    const time = useTime()
    const rotate = useTransform(
      time,
      [0, 4000], // For every 4 seconds...
      [0, 360], // ...rotate 360deg
      { clamp: false }
    )

[useSpring](./react-use-spring)

[useTransform](./react-use-transform)

