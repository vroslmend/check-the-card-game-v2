# LazyMotion

Source: https://motion.dev/docs/react-lazy-motion

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

LazyMotion

# LazyMotion

For ease of use, the `[motion](./react-motion-component)`[ component](./react-
motion-component) comes pre-bundled with all of its features for a bundlesize
of around 34kb.

With `LazyMotion` and the `m` component, we can reduce this to 6kb for the
initial render and then sync or async load a subset of features.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    import * as m from "motion/react-m"
    
    export const MyComponent = ({ isVisible }) => (
      <LazyMotion features={domAnimation}>
        <m.div animate={{ opacity: 1 }} />
      </LazyMotion>
    )

Read the [Reduce bundle size](./react-reduce-bundle-size) guide for full usage
instructions.

## Props

### `features`

Define a feature bundle to load sync or async.

#### Sync loading

Synchronous loading is useful for defining a subset of functionality for a
smaller bundlesize.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    import * as m from "motion/react-m"
    
    export const MyComponent = ({ isVisible }) => (
      <LazyMotion features={domAnimation}>
        <m.div animate={{ opacity: 1 }} />
      </LazyMotion>
    )

#### Async loading

Asynchronous loading can ensure your site is hydrated before loading in some
or all animation functionality.

    
    
    // features.js
    import { domAnimation } from "motion/react"
    export default domAnimations
      
    // index.js
    const loadFeatures = import("./features.js")
      .then(res => res.default)
    
    function Component() {
      return (
        <LazyMotion features={loadFeatures}>
          <m.div animate={{ scale: 1.5 }} />
        </LazyMotion>
      )
    }

### `strict`

**Default:** `false`

If `true`, will throw an error if a `motion` component renders within a
`LazyMotion` component (thereby removing the bundlesize benefits of lazy-
loading).

    
    
    // This component will throw an error that explains using a motion component
    // instead of the m component will break the benefits of code-splitting.
    function Component() {
      return (
        <LazyMotion features={domAnimation} strict>
          <motion.div />
        </LazyMotion>
      )
    }

For ease of use, the `[motion](./react-motion-component)`[ component](./react-
motion-component) comes pre-bundled with all of its features for a bundlesize
of around 34kb.

With `LazyMotion` and the `m` component, we can reduce this to 6kb for the
initial render and then sync or async load a subset of features.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    import * as m from "motion/react-m"
    
    export const MyComponent = ({ isVisible }) => (
      <LazyMotion features={domAnimation}>
        <m.div animate={{ opacity: 1 }} />
      </LazyMotion>
    )

Read the [Reduce bundle size](./react-reduce-bundle-size) guide for full usage
instructions.

## Props

### `features`

Define a feature bundle to load sync or async.

#### Sync loading

Synchronous loading is useful for defining a subset of functionality for a
smaller bundlesize.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    import * as m from "motion/react-m"
    
    export const MyComponent = ({ isVisible }) => (
      <LazyMotion features={domAnimation}>
        <m.div animate={{ opacity: 1 }} />
      </LazyMotion>
    )

#### Async loading

Asynchronous loading can ensure your site is hydrated before loading in some
or all animation functionality.

    
    
    // features.js
    import { domAnimation } from "motion/react"
    export default domAnimations
      
    // index.js
    const loadFeatures = import("./features.js")
      .then(res => res.default)
    
    function Component() {
      return (
        <LazyMotion features={loadFeatures}>
          <m.div animate={{ scale: 1.5 }} />
        </LazyMotion>
      )
    }

### `strict`

**Default:** `false`

If `true`, will throw an error if a `motion` component renders within a
`LazyMotion` component (thereby removing the bundlesize benefits of lazy-
loading).

    
    
    // This component will throw an error that explains using a motion component
    // instead of the m component will break the benefits of code-splitting.
    function Component() {
      return (
        <LazyMotion features={domAnimation} strict>
          <motion.div />
        </LazyMotion>
      )
    }

For ease of use, the `[motion](./react-motion-component)`[ component](./react-
motion-component) comes pre-bundled with all of its features for a bundlesize
of around 34kb.

With `LazyMotion` and the `m` component, we can reduce this to 6kb for the
initial render and then sync or async load a subset of features.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    import * as m from "motion/react-m"
    
    export const MyComponent = ({ isVisible }) => (
      <LazyMotion features={domAnimation}>
        <m.div animate={{ opacity: 1 }} />
      </LazyMotion>
    )

Read the [Reduce bundle size](./react-reduce-bundle-size) guide for full usage
instructions.

## Props

### `features`

Define a feature bundle to load sync or async.

#### Sync loading

Synchronous loading is useful for defining a subset of functionality for a
smaller bundlesize.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    import * as m from "motion/react-m"
    
    export const MyComponent = ({ isVisible }) => (
      <LazyMotion features={domAnimation}>
        <m.div animate={{ opacity: 1 }} />
      </LazyMotion>
    )

#### Async loading

Asynchronous loading can ensure your site is hydrated before loading in some
or all animation functionality.

    
    
    // features.js
    import { domAnimation } from "motion/react"
    export default domAnimations
      
    // index.js
    const loadFeatures = import("./features.js")
      .then(res => res.default)
    
    function Component() {
      return (
        <LazyMotion features={loadFeatures}>
          <m.div animate={{ scale: 1.5 }} />
        </LazyMotion>
      )
    }

### `strict`

**Default:** `false`

If `true`, will throw an error if a `motion` component renders within a
`LazyMotion` component (thereby removing the bundlesize benefits of lazy-
loading).

    
    
    // This component will throw an error that explains using a motion component
    // instead of the m component will break the benefits of code-splitting.
    function Component() {
      return (
        <LazyMotion features={domAnimation} strict>
          <motion.div />
        </LazyMotion>
      )
    }

[LayoutGroup](./react-layout-group)

[MotionConfig](./react-motion-config)

