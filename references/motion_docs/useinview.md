# useInView

Source: https://motion.dev/docs/react-use-in-view

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

useInView

# useInView

`useInView` is a tiny (0.6kb) hook that detects when the provided element is
within the viewport. It can be used with any React element.

    
    
    const ref = useRef(null)
    const isInView = useInView(ref)
    
    return <div ref={ref} />

## Usage

Import `useInView` from Motion:

    
    
    import { useInView } from "motion/react"

`useInView` can track the visibility of any HTML element. Pass a `ref` object
to both `useInView` and the HTML element.

    
    
    function Component() {
      const ref = useRef(null)
      const isInView = useInView(ref)
    
      return <div ref={ref} />
    }

While the element is outside the viewport, `useInView` will return `false`.
When it moves inside the view, it'll re-render the component and return
`true`.

### Effects

`useInView` is vanilla React state, so firing functions when `isInView`
changes is a matter of passing it to a `useEffect`.

    
    
    useEffect(() => {
      console.log("Element is in view: ", isInView)
    }, [isInView])

## Options

`useInView` can accept options to define how the element is tracked within the
viewport.

    
    
    const isInView = useInView(ref, { once: true })

### `root`

By default, `useInView` will track the visibility of an element as it
enters/leaves the window viewport. Set `root` to be the ref of a scrollable
parent, and it'll use that element to be the viewport instead.

    
    
    function Carousel() {
      const container = useRef(null)
      const ref = useRef(null)
      const isInView = useInView({ root: container })
      
      return (
        <div ref={container} style={{ overflow: "scroll" }}>
          <div ref={ref} />
        </div>
      )
    }

### `margin`

**Default:**`"0px"`

A margin to add to the viewport to change the detection area. Use multiple
values to adjust top/right/bottom/left, e.g. `"0px -20px 0px 100px"`.

    
    
    const isInView = useInView({
      margin: "0px 100px -50px 0px"
    })

**]Note:** For browser security reasons, `margin` [won't take affect within
cross-origin iframes](https://w3c.github.io/IntersectionObserver/#dom-
intersectionobserver-rootmargin) unless `root` is explicitly defined.

### `once`

**Default:**`false`

If `true`, once an element is in view, useInView will stop observing the
element and always return `true`.

    
    
    const isInView = useInView(ref, { once: true })

### `initial`

**Default:**`false`

Set an initial value to return until the element has been measured.

    
    
    const isInView = useInView(ref, { initial: true })

### `amount`

**Default:** `"some"`

The amount of an element that should enter the viewport to be considered
"entered". Either `"some"`, `"all"` or a number between `0` and `1`.

## Example

`useInView` is a tiny (0.6kb) hook that detects when the provided element is
within the viewport. It can be used with any React element.

    
    
    const ref = useRef(null)
    const isInView = useInView(ref)
    
    return <div ref={ref} />

## Usage

Import `useInView` from Motion:

    
    
    import { useInView } from "motion/react"

`useInView` can track the visibility of any HTML element. Pass a `ref` object
to both `useInView` and the HTML element.

    
    
    function Component() {
      const ref = useRef(null)
      const isInView = useInView(ref)
    
      return <div ref={ref} />
    }

While the element is outside the viewport, `useInView` will return `false`.
When it moves inside the view, it'll re-render the component and return
`true`.

### Effects

`useInView` is vanilla React state, so firing functions when `isInView`
changes is a matter of passing it to a `useEffect`.

    
    
    useEffect(() => {
      console.log("Element is in view: ", isInView)
    }, [isInView])

## Options

`useInView` can accept options to define how the element is tracked within the
viewport.

    
    
    const isInView = useInView(ref, { once: true })

### `root`

By default, `useInView` will track the visibility of an element as it
enters/leaves the window viewport. Set `root` to be the ref of a scrollable
parent, and it'll use that element to be the viewport instead.

    
    
    function Carousel() {
      const container = useRef(null)
      const ref = useRef(null)
      const isInView = useInView({ root: container })
      
      return (
        <div ref={container} style={{ overflow: "scroll" }}>
          <div ref={ref} />
        </div>
      )
    }

### `margin`

**Default:**`"0px"`

A margin to add to the viewport to change the detection area. Use multiple
values to adjust top/right/bottom/left, e.g. `"0px -20px 0px 100px"`.

    
    
    const isInView = useInView({
      margin: "0px 100px -50px 0px"
    })

**]Note:** For browser security reasons, `margin` [won't take affect within
cross-origin iframes](https://w3c.github.io/IntersectionObserver/#dom-
intersectionobserver-rootmargin) unless `root` is explicitly defined.

### `once`

**Default:**`false`

If `true`, once an element is in view, useInView will stop observing the
element and always return `true`.

    
    
    const isInView = useInView(ref, { once: true })

### `initial`

**Default:**`false`

Set an initial value to return until the element has been measured.

    
    
    const isInView = useInView(ref, { initial: true })

### `amount`

**Default:** `"some"`

The amount of an element that should enter the viewport to be considered
"entered". Either `"some"`, `"all"` or a number between `0` and `1`.

## Example

`useInView` is a tiny (0.6kb) hook that detects when the provided element is
within the viewport. It can be used with any React element.

    
    
    const ref = useRef(null)
    const isInView = useInView(ref)
    
    return <div ref={ref} />

## Usage

Import `useInView` from Motion:

    
    
    import { useInView } from "motion/react"

`useInView` can track the visibility of any HTML element. Pass a `ref` object
to both `useInView` and the HTML element.

    
    
    function Component() {
      const ref = useRef(null)
      const isInView = useInView(ref)
    
      return <div ref={ref} />
    }

While the element is outside the viewport, `useInView` will return `false`.
When it moves inside the view, it'll re-render the component and return
`true`.

### Effects

`useInView` is vanilla React state, so firing functions when `isInView`
changes is a matter of passing it to a `useEffect`.

    
    
    useEffect(() => {
      console.log("Element is in view: ", isInView)
    }, [isInView])

## Options

`useInView` can accept options to define how the element is tracked within the
viewport.

    
    
    const isInView = useInView(ref, { once: true })

### `root`

By default, `useInView` will track the visibility of an element as it
enters/leaves the window viewport. Set `root` to be the ref of a scrollable
parent, and it'll use that element to be the viewport instead.

    
    
    function Carousel() {
      const container = useRef(null)
      const ref = useRef(null)
      const isInView = useInView({ root: container })
      
      return (
        <div ref={container} style={{ overflow: "scroll" }}>
          <div ref={ref} />
        </div>
      )
    }

### `margin`

**Default:**`"0px"`

A margin to add to the viewport to change the detection area. Use multiple
values to adjust top/right/bottom/left, e.g. `"0px -20px 0px 100px"`.

    
    
    const isInView = useInView({
      margin: "0px 100px -50px 0px"
    })

**]Note:** For browser security reasons, `margin` [won't take affect within
cross-origin iframes](https://w3c.github.io/IntersectionObserver/#dom-
intersectionobserver-rootmargin) unless `root` is explicitly defined.

### `once`

**Default:**`false`

If `true`, once an element is in view, useInView will stop observing the
element and always return `true`.

    
    
    const isInView = useInView(ref, { once: true })

### `initial`

**Default:**`false`

Set an initial value to return until the element has been measured.

    
    
    const isInView = useInView(ref, { initial: true })

### `amount`

**Default:** `"some"`

The amount of an element that should enter the viewport to be considered
"entered". Either `"some"`, `"all"` or a number between `0` and `1`.

## Example

[useDragControls](./react-use-drag-controls)

[useReducedMotion](./react-use-reduced-motion)

