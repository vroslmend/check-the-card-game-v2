# useSpring

Source: https://motion.dev/docs/react-use-spring

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

useSpring

# useSpring

`useSpring` creates [a motion value](./react-motion-value) that will animate
to its latest target with a spring animation.

The target can either be set manually via `.set`, or automatically by passing
in another motion value.

## Usage

Import `useSpring` from Motion:

    
    
    import { useSpring } from "motion/react"

### Direct control

`useSpring` can be created with a number, or a unit-type (`px`, `%` etc)
string:

    
    
    const x = useSpring(0)
    const y = useSpring("100vh")

Now, whenever this motion value is updated via `set()`, the value will animate
to its new target with the defined spring.

    
    
    x.set(100)
    y.set("50vh")

It's also possible to update this value immediately, without a spring, with
[the ](./react-motion-value#jump)`[jump()](./react-motion-value#jump)`[
method](./react-motion-value#jump).

    
    
    x.jump(50)
    y.jump("0vh")

### Track another motion value

Its also possible to automatically spring towards the latest value of another
motion value:

    
    
    const x = useMotionValue(0)
    const y = useSpring(x)

This source motion value must also be a number, or unit-type string.

### Transition

The type of `spring` can be defined with the usual [spring transition
option](./react-transitions#spring).

    
    
    useSpring(0, { stiffness: 300 })

`useSpring` creates [a motion value](./react-motion-value) that will animate
to its latest target with a spring animation.

The target can either be set manually via `.set`, or automatically by passing
in another motion value.

## Usage

Import `useSpring` from Motion:

    
    
    import { useSpring } from "motion/react"

### Direct control

`useSpring` can be created with a number, or a unit-type (`px`, `%` etc)
string:

    
    
    const x = useSpring(0)
    const y = useSpring("100vh")

Now, whenever this motion value is updated via `set()`, the value will animate
to its new target with the defined spring.

    
    
    x.set(100)
    y.set("50vh")

It's also possible to update this value immediately, without a spring, with
[the ](./react-motion-value#jump)`[jump()](./react-motion-value#jump)`[
method](./react-motion-value#jump).

    
    
    x.jump(50)
    y.jump("0vh")

### Track another motion value

Its also possible to automatically spring towards the latest value of another
motion value:

    
    
    const x = useMotionValue(0)
    const y = useSpring(x)

This source motion value must also be a number, or unit-type string.

### Transition

The type of `spring` can be defined with the usual [spring transition
option](./react-transitions#spring).

    
    
    useSpring(0, { stiffness: 300 })

`useSpring` creates [a motion value](./react-motion-value) that will animate
to its latest target with a spring animation.

The target can either be set manually via `.set`, or automatically by passing
in another motion value.

## Usage

Import `useSpring` from Motion:

    
    
    import { useSpring } from "motion/react"

### Direct control

`useSpring` can be created with a number, or a unit-type (`px`, `%` etc)
string:

    
    
    const x = useSpring(0)
    const y = useSpring("100vh")

Now, whenever this motion value is updated via `set()`, the value will animate
to its new target with the defined spring.

    
    
    x.set(100)
    y.set("50vh")

It's also possible to update this value immediately, without a spring, with
[the ](./react-motion-value#jump)`[jump()](./react-motion-value#jump)`[
method](./react-motion-value#jump).

    
    
    x.jump(50)
    y.jump("0vh")

### Track another motion value

Its also possible to automatically spring towards the latest value of another
motion value:

    
    
    const x = useMotionValue(0)
    const y = useSpring(x)

This source motion value must also be a number, or unit-type string.

### Transition

The type of `spring` can be defined with the usual [spring transition
option](./react-transitions#spring).

    
    
    useSpring(0, { stiffness: 300 })

useSpring

Examples

## Go beyond the basics

[Motion+](../plus) is a one-time fee, lifetime membership.

As well as premium Motion features, early access content, and a private
Discord community, you'll unlock access to the source code of 90+ premium
examples that take the APIs on this page to the next level.

Loading...

Loading...

Loading...

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[useScroll](./react-use-scroll)

[useTime](./react-use-time)

