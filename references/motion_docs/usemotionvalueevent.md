# useMotionValueEvent

Source: https://motion.dev/docs/react-use-motion-value-event

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

useMotionValueEvent

# useMotionValueEvent

`useMotionValueEvent` manages a motion value event handler throughout the
lifecycle of a React component.

    
    
    function Component() {
      const x = useMotionValue(0)
      
      useMotionValueEvent(x, "animationStart", () => {
        console.log("animation started on x")
      })
      
      useMotionValueEvent(x, "change", (latest) => {
        console.log("x changed to", latest)
      })
      
      return <motion.div style={{ x }} />
    }

When the component is unmounted, event handlers will be safely cleaned up.

## Usage

Import from Motion:

    
    
    import { useMotionValueEvent } from "motion/react"

To add an event listener to a motion value, provide the value, event name and
callback:

    
    
    const color = useMotionValue("#00f")
    
    useMotionValueEvent(color, "change", (latest) => {
      console.log(latest)
    })

Available events are:

  * `change`

  * `animationStart`

  * `animationComplete`

  * `animationCancel`

`"change"` events are provided the latest value of the motion value.

### Advanced

`useMotionValueEvent` is a helper function for a motion value's `[on](./react-
motion-value)`[ method](./react-motion-value). With `on`, you can start
listening to events whenever you like, for instance within an event handler.
But remember to also unsubscribe when the component unmounts.

    
    
    useEffect(() => {
      const doSomething = () => {}
      
      const unsubX = x.on("change", doSomething)
      const unsubY = y.on("change", doSomething)
      
      return () => {
        unsubX()
        unsubY()
      }
    }, [x, y])

`useMotionValueEvent` manages a motion value event handler throughout the
lifecycle of a React component.

    
    
    function Component() {
      const x = useMotionValue(0)
      
      useMotionValueEvent(x, "animationStart", () => {
        console.log("animation started on x")
      })
      
      useMotionValueEvent(x, "change", (latest) => {
        console.log("x changed to", latest)
      })
      
      return <motion.div style={{ x }} />
    }

When the component is unmounted, event handlers will be safely cleaned up.

## Usage

Import from Motion:

    
    
    import { useMotionValueEvent } from "motion/react"

To add an event listener to a motion value, provide the value, event name and
callback:

    
    
    const color = useMotionValue("#00f")
    
    useMotionValueEvent(color, "change", (latest) => {
      console.log(latest)
    })

Available events are:

  * `change`

  * `animationStart`

  * `animationComplete`

  * `animationCancel`

`"change"` events are provided the latest value of the motion value.

### Advanced

`useMotionValueEvent` is a helper function for a motion value's `[on](./react-
motion-value)`[ method](./react-motion-value). With `on`, you can start
listening to events whenever you like, for instance within an event handler.
But remember to also unsubscribe when the component unmounts.

    
    
    useEffect(() => {
      const doSomething = () => {}
      
      const unsubX = x.on("change", doSomething)
      const unsubY = y.on("change", doSomething)
      
      return () => {
        unsubX()
        unsubY()
      }
    }, [x, y])

`useMotionValueEvent` manages a motion value event handler throughout the
lifecycle of a React component.

    
    
    function Component() {
      const x = useMotionValue(0)
      
      useMotionValueEvent(x, "animationStart", () => {
        console.log("animation started on x")
      })
      
      useMotionValueEvent(x, "change", (latest) => {
        console.log("x changed to", latest)
      })
      
      return <motion.div style={{ x }} />
    }

When the component is unmounted, event handlers will be safely cleaned up.

## Usage

Import from Motion:

    
    
    import { useMotionValueEvent } from "motion/react"

To add an event listener to a motion value, provide the value, event name and
callback:

    
    
    const color = useMotionValue("#00f")
    
    useMotionValueEvent(color, "change", (latest) => {
      console.log(latest)
    })

Available events are:

  * `change`

  * `animationStart`

  * `animationComplete`

  * `animationCancel`

`"change"` events are provided the latest value of the motion value.

### Advanced

`useMotionValueEvent` is a helper function for a motion value's `[on](./react-
motion-value)`[ method](./react-motion-value). With `on`, you can start
listening to events whenever you like, for instance within an event handler.
But remember to also unsubscribe when the component unmounts.

    
    
    useEffect(() => {
      const doSomething = () => {}
      
      const unsubX = x.on("change", doSomething)
      const unsubY = y.on("change", doSomething)
      
      return () => {
        unsubX()
        unsubY()
      }
    }, [x, y])

[useMotionTemplate](./react-use-motion-template)

[useScroll](./react-use-scroll)

