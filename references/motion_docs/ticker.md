# Ticker

Source: https://motion.dev/docs/react-ticker

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

Ticker

# Ticker

[Motion+ Exclusive](../plus)

Checking Motion+ status…

This content is exclusive to Motion+ members

[Get Motion+ for instant access](../sponsor)

One-time payment, no subscription

Already joined?

[Login](https://plus.motion.dev/login)

Checking Motion+ status…

This content is exclusive to Motion+ members

[Get Motion+ for instant access](../sponsor)

One-time payment, no subscription

Already joined?

[Login](https://plus.motion.dev/login)

Checking Motion+ status…

This content is exclusive to Motion+ members

[Get Motion+ for instant access](../sponsor)

One-time payment, no subscription

Already joined?

[Login](https://plus.motion.dev/login)

Ticker makes it quick and simple to build infinitely-scrolling marquee-style
animations.

It's exclusive to [Motion+](../plus) members. Motion+ is a one-time fee, all-
in membership that offers exclusive components, premium examples and access to
a private Discord community.

Motion+ Ticker is:

  * **Lightweight:** Just `+2.1kb` on top of Motion for React.

  * **Accessible:** Focus trapping for unobtrusive keyboard navigation and mandatory respect for "reduced motion" OS settings.

  * **Multiaxis:** Create either vertical or horizontal tickers.

  * **Flexible:** Defaults to a velocity-based animation but can be powered by your own [motion values](./react-motion-value).

  * **Performant:** Clones the theoretical minimum of elements.

Its simple API makes infinite tickers quick to make. Items are automatically
repeated, meaning the absolute minimum number of clones are created for the
current viewport.

    
    
    <Ticker items={["😂"]} />

Powered by `[<motion>](./react-motion-component)`[ components](./react-motion-
component), it's straightforward to drive the ticker offset with motion values
to create scroll-driven or draggable tickers.

    
    
    const { scrollY } = useScroll()
    
    return <Ticker offset={scrollY} />

It's also fully compatible with other Motion components, like
`AnimatePresence` and `[Cursor](./cursor)`:

In this guide, we'll learn how to install `Ticker` and use it to create
various animation effects.

[Reorder](./react-reorder)

[Motion values overview](./react-motion-value)

