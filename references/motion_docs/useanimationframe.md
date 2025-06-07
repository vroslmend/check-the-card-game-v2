# useAnimationFrame

Source: https://motion.dev/docs/react-use-animation-frame

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

useAnimationFrame

# useAnimationFrame

`useAnimationFrame` runs a callback once every animation frame.

    
    
    useAnimationFrame((time) => {
      ref.current.style.transform = `rotateY(${time}deg)`
    })

The callback is provided two arguments:

  * `time`, the total duration of time since the callback was first called.

  * `delta`, the total duration of time since the last animation frame.

    
    
    import { useAnimationFrame } from "motion/react"
    
    function Component() {
      const ref = useRef(null)
      
      useAnimationFrame((time, delta) => {
        ref.current.style.transform = `rotateY(${time}deg)`
      })
    
      return <div ref={ref} />
    }

`useAnimationFrame` runs a callback once every animation frame.

    
    
    useAnimationFrame((time) => {
      ref.current.style.transform = `rotateY(${time}deg)`
    })

The callback is provided two arguments:

  * `time`, the total duration of time since the callback was first called.

  * `delta`, the total duration of time since the last animation frame.

    
    
    import { useAnimationFrame } from "motion/react"
    
    function Component() {
      const ref = useRef(null)
      
      useAnimationFrame((time, delta) => {
        ref.current.style.transform = `rotateY(${time}deg)`
      })
    
      return <div ref={ref} />
    }

`useAnimationFrame` runs a callback once every animation frame.

    
    
    useAnimationFrame((time) => {
      ref.current.style.transform = `rotateY(${time}deg)`
    })

The callback is provided two arguments:

  * `time`, the total duration of time since the callback was first called.

  * `delta`, the total duration of time since the last animation frame.

    
    
    import { useAnimationFrame } from "motion/react"
    
    function Component() {
      const ref = useRef(null)
      
      useAnimationFrame((time, delta) => {
        ref.current.style.transform = `rotateY(${time}deg)`
      })
    
      return <div ref={ref} />
    }

[useAnimate](./react-use-animate)

[useDragControls](./react-use-drag-controls)

