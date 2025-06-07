# useMotionTemplate

Source: https://motion.dev/docs/react-use-motion-template

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

useMotionTemplate

# useMotionTemplate

`useMotionTemplate` creates a new [motion value](./react-motion-value) from a
[string template](https://developer.mozilla.org/en-
US/docs/Web/JavaScript/Reference/Template_literals) containing other motion
values.

    
    
    const x = useMotionValue(100)
    const transform = useMotionTemplate`transform(${x}px)`

Whenever a motion value within the string template updates, the returned
motion value will update with the latest value.

## Usage

Import from Motion:

    
    
    import { useMotionTemplate } from "motion/react"

`useMotionTemplate` is a "tagged template", so rather than being called like a
normal function, it's called as a string template:

    
    
    useMotionValue``

This string template can accept both text and other motion values:

    
    
    const blur = useMotionValue(10)
    const saturate = useMotionValue(50)
    const filter = useMotionTemplate`blur(${10}px) saturate(${saturate}%)`
    
    return <motion.div style={{ filter }} />

The latest value of the returned motion value will be the string template with
each provided motion value replaced with its latest value.

    
    
    const shadowX = useSpring(0)
    const shadowY = useMotionValue(0)
    
    const filter = useMotionTemplate`drop-shadow(${shadowX}px ${shadowY}px 20px rgba(0,0,0,0.3))`
    
    return <motion.div style={{ filter }} />

`useMotionTemplate` creates a new [motion value](./react-motion-value) from a
[string template](https://developer.mozilla.org/en-
US/docs/Web/JavaScript/Reference/Template_literals) containing other motion
values.

    
    
    const x = useMotionValue(100)
    const transform = useMotionTemplate`transform(${x}px)`

Whenever a motion value within the string template updates, the returned
motion value will update with the latest value.

## Usage

Import from Motion:

    
    
    import { useMotionTemplate } from "motion/react"

`useMotionTemplate` is a "tagged template", so rather than being called like a
normal function, it's called as a string template:

    
    
    useMotionValue``

This string template can accept both text and other motion values:

    
    
    const blur = useMotionValue(10)
    const saturate = useMotionValue(50)
    const filter = useMotionTemplate`blur(${10}px) saturate(${saturate}%)`
    
    return <motion.div style={{ filter }} />

The latest value of the returned motion value will be the string template with
each provided motion value replaced with its latest value.

    
    
    const shadowX = useSpring(0)
    const shadowY = useMotionValue(0)
    
    const filter = useMotionTemplate`drop-shadow(${shadowX}px ${shadowY}px 20px rgba(0,0,0,0.3))`
    
    return <motion.div style={{ filter }} />

`useMotionTemplate` creates a new [motion value](./react-motion-value) from a
[string template](https://developer.mozilla.org/en-
US/docs/Web/JavaScript/Reference/Template_literals) containing other motion
values.

    
    
    const x = useMotionValue(100)
    const transform = useMotionTemplate`transform(${x}px)`

Whenever a motion value within the string template updates, the returned
motion value will update with the latest value.

## Usage

Import from Motion:

    
    
    import { useMotionTemplate } from "motion/react"

`useMotionTemplate` is a "tagged template", so rather than being called like a
normal function, it's called as a string template:

    
    
    useMotionValue``

This string template can accept both text and other motion values:

    
    
    const blur = useMotionValue(10)
    const saturate = useMotionValue(50)
    const filter = useMotionTemplate`blur(${10}px) saturate(${saturate}%)`
    
    return <motion.div style={{ filter }} />

The latest value of the returned motion value will be the string template with
each provided motion value replaced with its latest value.

    
    
    const shadowX = useSpring(0)
    const shadowY = useMotionValue(0)
    
    const filter = useMotionTemplate`drop-shadow(${shadowX}px ${shadowY}px 20px rgba(0,0,0,0.3))`
    
    return <motion.div style={{ filter }} />

useMotionTemplate

Examples

## Go beyond the basics

[Motion+](../plus) is a one-time fee, lifetime membership.

As well as premium Motion features, early access content, and a private
Discord community, you'll unlock access to the source code of 90+ premium
examples that take the APIs on this page to the next level.

Loading...

Loading...

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[Motion values overview](./react-motion-value)

[useMotionValueEvent](./react-use-motion-value-event)

