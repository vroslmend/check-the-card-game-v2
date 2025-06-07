# Get started with Motion for React

Source: https://motion.dev/docs/react-quick-start

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

Get started

# Get started with Motion for React

Motion for React is an animation library that's simple to start and fun to
master.

It's the only library with a **hybrid engine**. This means it offers both the
hardware accelerated performance of native browser animations, coupled with
the limitless potential of JavaScript animations.

It's also trusted by [Framer](https://framer.com) to power its amazing no-code
animations and gestures.

In this guide, we'll learn how to install Motion and take a whirlwind tour of
its main features.

## Install

Motion is available via npm:

    
    
    npm install motion

Features can now be imported via `"motion/react"`:

    
    
    import { motion } from "motion/react"

**Note:** Motion for React contains APIs specifically tailored for React, but
every feature from [vanilla Motion ](./quick-start)is also compatible and
available for advanced use-cases.

## Usage

The core of Motion for React is [the ](./react-motion-component)`[<motion
/>](./react-motion-component)`[ component](./react-motion-component). It's a
normal DOM element, supercharged with animation capabilities.

    
    
    <motion.div />

Animating a `motion` component is as straightforward as setting values via the
`animate` prop:

    
    
    <motion.ul animate={{ rotate: 360 }} />

When values in `animate` change, the component will animate. Motion has
intuitive defaults, but animations can of course be configured via [the
](./react-transitions)`[transition](./react-transitions)`[ prop](./react-
transitions).

    
    
    <motion.div
      animate={{
        scale: 2,
        transition: { duration: 2 }
      }}
    />

### Enter animation

When a component enters the page, it will automatically animate to the values
defined in the `animate` prop.

You can provide values to animate from via the `initial` prop, otherwise these
will be read from the DOM.

    
    
    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} />

Or disable this initial animation entirely by setting `initial` to `false`.

    
    
    <motion.button initial={false} animate={{ scale: 1 }} />

### Gestures

`<motion />` extends React's event system with powerful gesture recognisers.
It currently supports hover, tap, focus, and drag.

    
    
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => console.log('hover started!')}
    />

Motion's gestures are designed to feel better than using CSS or JavaScript
events alone. [Learn more about Motion's gestures](./react-gestures).

### Scroll animations

Motion supports both types of scroll animations, **scroll-triggered** and
**scroll-linked**.

To trigger an animation on scroll, the `whileInView` prop defines a state to
animate to/from when an element enters/leaves the viewport:

    
    
    <motion.div
      initial={{ backgroundColor: "rgb(0, 255, 0)", opacity: 0 }}
      whileInView={{ backgroundColor: "rgb(255, 0, 0)", opacity: 1 }}
    />

Whereas to link a value directly to scroll position, it's possible to use
`MotionValue`s via `useScroll`.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

[Learn more](./react-scroll-animations) about Motion's scroll animations.

### Layout animations

Motion has an industry-leading layout animation engine that supports animating
between changes in layout, using only transforms, between the same or
different elements, with full scale correction.

It's as easy as applying the `layout` prop.

    
    
    <motion.div layout />

Or to animate between different elements, a `layoutId`:

    
    
    <motion.div layoutId="underline" />

[Learn more](./react-layout-animations) about layout animations.

### Exit animations

Animating elements when they're removed from the DOM is usually messy.

By wrapping `motion` components with `<AnimatePresence>` we gain access to the
`exit` prop.

    
    
    <AnimatePresence>
      {show ? <motion.div key="box" exit={{ opacity: 0 }} /> : null}
    </AnimatePresence>

[Learn more](./react-animate-presence) about `AnimatePresence`.

## Learn next

That's a very quick overview of Motion for React's basic features. But there's
a lot more to learn!

Next, we recommend diving further into the [the ](./react-motion-
component)`[<motion />](./react-motion-component)`[ component](./react-motion-
component) to learn more about its powerful features, like variants.

Or, you can dive straight in to our [Fundamentals
examples](https://examples.motion.dev/react#fundamentals). Each comes complete
with full source code that you can copy/paste into your project.

Motion for React is an animation library that's simple to start and fun to
master.

It's the only library with a **hybrid engine**. This means it offers both the
hardware accelerated performance of native browser animations, coupled with
the limitless potential of JavaScript animations.

It's also trusted by [Framer](https://framer.com) to power its amazing no-code
animations and gestures.

In this guide, we'll learn how to install Motion and take a whirlwind tour of
its main features.

## Install

Motion is available via npm:

    
    
    npm install motion

Features can now be imported via `"motion/react"`:

    
    
    import { motion } from "motion/react"

**Note:** Motion for React contains APIs specifically tailored for React, but
every feature from [vanilla Motion ](./quick-start)is also compatible and
available for advanced use-cases.

## Usage

The core of Motion for React is [the ](./react-motion-component)`[<motion
/>](./react-motion-component)`[ component](./react-motion-component). It's a
normal DOM element, supercharged with animation capabilities.

    
    
    <motion.div />

Animating a `motion` component is as straightforward as setting values via the
`animate` prop:

    
    
    <motion.ul animate={{ rotate: 360 }} />

When values in `animate` change, the component will animate. Motion has
intuitive defaults, but animations can of course be configured via [the
](./react-transitions)`[transition](./react-transitions)`[ prop](./react-
transitions).

    
    
    <motion.div
      animate={{
        scale: 2,
        transition: { duration: 2 }
      }}
    />

### Enter animation

When a component enters the page, it will automatically animate to the values
defined in the `animate` prop.

You can provide values to animate from via the `initial` prop, otherwise these
will be read from the DOM.

    
    
    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} />

Or disable this initial animation entirely by setting `initial` to `false`.

    
    
    <motion.button initial={false} animate={{ scale: 1 }} />

### Gestures

`<motion />` extends React's event system with powerful gesture recognisers.
It currently supports hover, tap, focus, and drag.

    
    
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => console.log('hover started!')}
    />

Motion's gestures are designed to feel better than using CSS or JavaScript
events alone. [Learn more about Motion's gestures](./react-gestures).

### Scroll animations

Motion supports both types of scroll animations, **scroll-triggered** and
**scroll-linked**.

To trigger an animation on scroll, the `whileInView` prop defines a state to
animate to/from when an element enters/leaves the viewport:

    
    
    <motion.div
      initial={{ backgroundColor: "rgb(0, 255, 0)", opacity: 0 }}
      whileInView={{ backgroundColor: "rgb(255, 0, 0)", opacity: 1 }}
    />

Whereas to link a value directly to scroll position, it's possible to use
`MotionValue`s via `useScroll`.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

[Learn more](./react-scroll-animations) about Motion's scroll animations.

### Layout animations

Motion has an industry-leading layout animation engine that supports animating
between changes in layout, using only transforms, between the same or
different elements, with full scale correction.

It's as easy as applying the `layout` prop.

    
    
    <motion.div layout />

Or to animate between different elements, a `layoutId`:

    
    
    <motion.div layoutId="underline" />

[Learn more](./react-layout-animations) about layout animations.

### Exit animations

Animating elements when they're removed from the DOM is usually messy.

By wrapping `motion` components with `<AnimatePresence>` we gain access to the
`exit` prop.

    
    
    <AnimatePresence>
      {show ? <motion.div key="box" exit={{ opacity: 0 }} /> : null}
    </AnimatePresence>

[Learn more](./react-animate-presence) about `AnimatePresence`.

## Learn next

That's a very quick overview of Motion for React's basic features. But there's
a lot more to learn!

Next, we recommend diving further into the [the ](./react-motion-
component)`[<motion />](./react-motion-component)`[ component](./react-motion-
component) to learn more about its powerful features, like variants.

Or, you can dive straight in to our [Fundamentals
examples](https://examples.motion.dev/react#fundamentals). Each comes complete
with full source code that you can copy/paste into your project.

Motion for React is an animation library that's simple to start and fun to
master.

It's the only library with a **hybrid engine**. This means it offers both the
hardware accelerated performance of native browser animations, coupled with
the limitless potential of JavaScript animations.

It's also trusted by [Framer](https://framer.com) to power its amazing no-code
animations and gestures.

In this guide, we'll learn how to install Motion and take a whirlwind tour of
its main features.

## Install

Motion is available via npm:

    
    
    npm install motion

Features can now be imported via `"motion/react"`:

    
    
    import { motion } from "motion/react"

**Note:** Motion for React contains APIs specifically tailored for React, but
every feature from [vanilla Motion ](./quick-start)is also compatible and
available for advanced use-cases.

## Usage

The core of Motion for React is [the ](./react-motion-component)`[<motion
/>](./react-motion-component)`[ component](./react-motion-component). It's a
normal DOM element, supercharged with animation capabilities.

    
    
    <motion.div />

Animating a `motion` component is as straightforward as setting values via the
`animate` prop:

    
    
    <motion.ul animate={{ rotate: 360 }} />

When values in `animate` change, the component will animate. Motion has
intuitive defaults, but animations can of course be configured via [the
](./react-transitions)`[transition](./react-transitions)`[ prop](./react-
transitions).

    
    
    <motion.div
      animate={{
        scale: 2,
        transition: { duration: 2 }
      }}
    />

### Enter animation

When a component enters the page, it will automatically animate to the values
defined in the `animate` prop.

You can provide values to animate from via the `initial` prop, otherwise these
will be read from the DOM.

    
    
    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} />

Or disable this initial animation entirely by setting `initial` to `false`.

    
    
    <motion.button initial={false} animate={{ scale: 1 }} />

### Gestures

`<motion />` extends React's event system with powerful gesture recognisers.
It currently supports hover, tap, focus, and drag.

    
    
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => console.log('hover started!')}
    />

Motion's gestures are designed to feel better than using CSS or JavaScript
events alone. [Learn more about Motion's gestures](./react-gestures).

### Scroll animations

Motion supports both types of scroll animations, **scroll-triggered** and
**scroll-linked**.

To trigger an animation on scroll, the `whileInView` prop defines a state to
animate to/from when an element enters/leaves the viewport:

    
    
    <motion.div
      initial={{ backgroundColor: "rgb(0, 255, 0)", opacity: 0 }}
      whileInView={{ backgroundColor: "rgb(255, 0, 0)", opacity: 1 }}
    />

Whereas to link a value directly to scroll position, it's possible to use
`MotionValue`s via `useScroll`.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

[Learn more](./react-scroll-animations) about Motion's scroll animations.

### Layout animations

Motion has an industry-leading layout animation engine that supports animating
between changes in layout, using only transforms, between the same or
different elements, with full scale correction.

It's as easy as applying the `layout` prop.

    
    
    <motion.div layout />

Or to animate between different elements, a `layoutId`:

    
    
    <motion.div layoutId="underline" />

[Learn more](./react-layout-animations) about layout animations.

### Exit animations

Animating elements when they're removed from the DOM is usually messy.

By wrapping `motion` components with `<AnimatePresence>` we gain access to the
`exit` prop.

    
    
    <AnimatePresence>
      {show ? <motion.div key="box" exit={{ opacity: 0 }} /> : null}
    </AnimatePresence>

[Learn more](./react-animate-presence) about `AnimatePresence`.

## Learn next

That's a very quick overview of Motion for React's basic features. But there's
a lot more to learn!

Next, we recommend diving further into the [the ](./react-motion-
component)`[<motion />](./react-motion-component)`[ component](./react-motion-
component) to learn more about its powerful features, like variants.

Or, you can dive straight in to our [Fundamentals
examples](https://examples.motion.dev/react#fundamentals). Each comes complete
with full source code that you can copy/paste into your project.

[Integrate Motion with Radix](./vue-radix)

[React animation](./react-animation)

