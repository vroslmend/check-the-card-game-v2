# useTransform

Source: https://motion.dev/docs/react-use-transform

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

useTransform

# useTransform

`useTransform` creates a new motion value that transforms the output of one or
more motion values.

    
    
    const x = useMotionValue(1)
    const y = useMotionValue(1)
    
    const z = useTransform(() => x.get() + y.get()) // z.get() === 2

## Usage

Import from Motion:

    
    
    import { useTransform } from "motion/react"

`useTransform` can be used in two ways: with a transform function and via
value maps:

    
    
    // Transform function
    useTransform(() => x.get() * 2)
    
    // Value mapping
    useTransform(x, [0, 100], ["#f00", "00f"])

### Transform function

A transform function is a normal function that returns a value.

    
    
    useTransform(() => x.get() * 2)

Any motion values read in this function via the `get()` method will be
automatically subscribed to.

When these motion values change, the function will be run again on the next
animation frame to calculate a new value.

    
    
    const distance = 100
    const time = useTime()
    const y = useTransform(() => Math.sin(time.get() / 1000) * distance)

### Value mapping

`useTransform` can also map a single motion value from one range of values to
another.

To illustrate, look at this `x` motion value:

    
    
    const x = useMotionValue(0)

We can use `useTransform` to create a new motion value called `opacity`.

    
    
    const opacity = useTransform(x, input, output)

By defining an `input` range and an `output` range, we can define
relationships like "when `x` is `0`, `opacity` should be `1`. When `x` is
`100` pixels either side, `opacity` should be `0`".

    
    
    const input = [-100, 0, 100]
    const output = [0, 1, 0]

Both ranges can be **any length** but must be the **same length** as each
other.

The input range must always be a series of increasing or decreasing numbers.

The output range must be values all of the same type, but can be in any order.
It can also be any [value type that Motion can animate](./react-
animation#animatable-values), like numbers, units, colors and other strings.

    
    
    const backgroundColor = useTransform(
      x,
      [0, 100],
      ["#f00", "#00f"]
    )

By setting `clamp: false`, the ranges will map perpetually. For instance, in
this example we're saying "for every `100px` scrolled, rotate another
`360deg`":

    
    
    const { scrollY } = useScroll()
    const rotate = useTransform(
      scrollY,
      [0, 100],
      [0, 360],
      { clamp: false }
    )

## Options

With value mapping, we can set some additional options.

### `clamp`

**Default:** `true`

If `true`, will clamp output to within the provided range. If `false`, will
carry on mapping even when the input falls outside the provided range.

    
    
    const y = useTransform(x, [0, 1], [0, 2])
    const z = useTransform(x, [0, 1], [0, 2], { clamp: false })
    
    useEffect(() => {
      x.set(2)
      console.log(y.get()) // 2, input clamped
      console.log(z.get()) // 4
    })

### `ease`

An easing function, or array of easing functions, to ease the mixing between
each value.

These must be JavaScript functions.

    
    
    import { cubicBezier, circOut } from "motion"
    import { useTransform } from "motion/react"
    
    // In your component
    const y = useTransform(x, [0, 1], [0, 2], { ease: circOut })
    
    const z = useTransform(
      x,
      [0, 1],
      [0, 2],
      { ease: cubicBezier(0.17, 0.67, 0.83, 0.67) }
    )

### `mixer`

A function to use to mix between each pair of output values.

This function will be called with each pair of output values and must return a
new function, that accepts a progress value between `0` and `1` and returns
the mixed value.

This can be used to inject more advanced mixers than Framer Motion's default,
for instance [Flubber](https://github.com/veltman/flubber) for morphing SVG
paths.

`useTransform` creates a new motion value that transforms the output of one or
more motion values.

    
    
    const x = useMotionValue(1)
    const y = useMotionValue(1)
    
    const z = useTransform(() => x.get() + y.get()) // z.get() === 2

## Usage

Import from Motion:

    
    
    import { useTransform } from "motion/react"

`useTransform` can be used in two ways: with a transform function and via
value maps:

    
    
    // Transform function
    useTransform(() => x.get() * 2)
    
    // Value mapping
    useTransform(x, [0, 100], ["#f00", "00f"])

### Transform function

A transform function is a normal function that returns a value.

    
    
    useTransform(() => x.get() * 2)

Any motion values read in this function via the `get()` method will be
automatically subscribed to.

When these motion values change, the function will be run again on the next
animation frame to calculate a new value.

    
    
    const distance = 100
    const time = useTime()
    const y = useTransform(() => Math.sin(time.get() / 1000) * distance)

### Value mapping

`useTransform` can also map a single motion value from one range of values to
another.

To illustrate, look at this `x` motion value:

    
    
    const x = useMotionValue(0)

We can use `useTransform` to create a new motion value called `opacity`.

    
    
    const opacity = useTransform(x, input, output)

By defining an `input` range and an `output` range, we can define
relationships like "when `x` is `0`, `opacity` should be `1`. When `x` is
`100` pixels either side, `opacity` should be `0`".

    
    
    const input = [-100, 0, 100]
    const output = [0, 1, 0]

Both ranges can be **any length** but must be the **same length** as each
other.

The input range must always be a series of increasing or decreasing numbers.

The output range must be values all of the same type, but can be in any order.
It can also be any [value type that Motion can animate](./react-
animation#animatable-values), like numbers, units, colors and other strings.

    
    
    const backgroundColor = useTransform(
      x,
      [0, 100],
      ["#f00", "#00f"]
    )

By setting `clamp: false`, the ranges will map perpetually. For instance, in
this example we're saying "for every `100px` scrolled, rotate another
`360deg`":

    
    
    const { scrollY } = useScroll()
    const rotate = useTransform(
      scrollY,
      [0, 100],
      [0, 360],
      { clamp: false }
    )

## Options

With value mapping, we can set some additional options.

### `clamp`

**Default:** `true`

If `true`, will clamp output to within the provided range. If `false`, will
carry on mapping even when the input falls outside the provided range.

    
    
    const y = useTransform(x, [0, 1], [0, 2])
    const z = useTransform(x, [0, 1], [0, 2], { clamp: false })
    
    useEffect(() => {
      x.set(2)
      console.log(y.get()) // 2, input clamped
      console.log(z.get()) // 4
    })

### `ease`

An easing function, or array of easing functions, to ease the mixing between
each value.

These must be JavaScript functions.

    
    
    import { cubicBezier, circOut } from "motion"
    import { useTransform } from "motion/react"
    
    // In your component
    const y = useTransform(x, [0, 1], [0, 2], { ease: circOut })
    
    const z = useTransform(
      x,
      [0, 1],
      [0, 2],
      { ease: cubicBezier(0.17, 0.67, 0.83, 0.67) }
    )

### `mixer`

A function to use to mix between each pair of output values.

This function will be called with each pair of output values and must return a
new function, that accepts a progress value between `0` and `1` and returns
the mixed value.

This can be used to inject more advanced mixers than Framer Motion's default,
for instance [Flubber](https://github.com/veltman/flubber) for morphing SVG
paths.

`useTransform` creates a new motion value that transforms the output of one or
more motion values.

    
    
    const x = useMotionValue(1)
    const y = useMotionValue(1)
    
    const z = useTransform(() => x.get() + y.get()) // z.get() === 2

## Usage

Import from Motion:

    
    
    import { useTransform } from "motion/react"

`useTransform` can be used in two ways: with a transform function and via
value maps:

    
    
    // Transform function
    useTransform(() => x.get() * 2)
    
    // Value mapping
    useTransform(x, [0, 100], ["#f00", "00f"])

### Transform function

A transform function is a normal function that returns a value.

    
    
    useTransform(() => x.get() * 2)

Any motion values read in this function via the `get()` method will be
automatically subscribed to.

When these motion values change, the function will be run again on the next
animation frame to calculate a new value.

    
    
    const distance = 100
    const time = useTime()
    const y = useTransform(() => Math.sin(time.get() / 1000) * distance)

### Value mapping

`useTransform` can also map a single motion value from one range of values to
another.

To illustrate, look at this `x` motion value:

    
    
    const x = useMotionValue(0)

We can use `useTransform` to create a new motion value called `opacity`.

    
    
    const opacity = useTransform(x, input, output)

By defining an `input` range and an `output` range, we can define
relationships like "when `x` is `0`, `opacity` should be `1`. When `x` is
`100` pixels either side, `opacity` should be `0`".

    
    
    const input = [-100, 0, 100]
    const output = [0, 1, 0]

Both ranges can be **any length** but must be the **same length** as each
other.

The input range must always be a series of increasing or decreasing numbers.

The output range must be values all of the same type, but can be in any order.
It can also be any [value type that Motion can animate](./react-
animation#animatable-values), like numbers, units, colors and other strings.

    
    
    const backgroundColor = useTransform(
      x,
      [0, 100],
      ["#f00", "#00f"]
    )

By setting `clamp: false`, the ranges will map perpetually. For instance, in
this example we're saying "for every `100px` scrolled, rotate another
`360deg`":

    
    
    const { scrollY } = useScroll()
    const rotate = useTransform(
      scrollY,
      [0, 100],
      [0, 360],
      { clamp: false }
    )

## Options

With value mapping, we can set some additional options.

### `clamp`

**Default:** `true`

If `true`, will clamp output to within the provided range. If `false`, will
carry on mapping even when the input falls outside the provided range.

    
    
    const y = useTransform(x, [0, 1], [0, 2])
    const z = useTransform(x, [0, 1], [0, 2], { clamp: false })
    
    useEffect(() => {
      x.set(2)
      console.log(y.get()) // 2, input clamped
      console.log(z.get()) // 4
    })

### `ease`

An easing function, or array of easing functions, to ease the mixing between
each value.

These must be JavaScript functions.

    
    
    import { cubicBezier, circOut } from "motion"
    import { useTransform } from "motion/react"
    
    // In your component
    const y = useTransform(x, [0, 1], [0, 2], { ease: circOut })
    
    const z = useTransform(
      x,
      [0, 1],
      [0, 2],
      { ease: cubicBezier(0.17, 0.67, 0.83, 0.67) }
    )

### `mixer`

A function to use to mix between each pair of output values.

This function will be called with each pair of output values and must return a
new function, that accepts a progress value between `0` and `1` and returns
the mixed value.

This can be used to inject more advanced mixers than Framer Motion's default,
for instance [Flubber](https://github.com/veltman/flubber) for morphing SVG
paths.

useTransform

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

[useTime](./react-use-time)

[useVelocity](./react-use-velocity)

