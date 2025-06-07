# MotionCanvas

Source: https://motion.dev/docs/react-three-fiber-motion-canvas

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

MotionCanvas

# MotionCanvas

Deprecated

Deprecated

React Three Fiber (R3F) uses the [Canvas
component](https://docs.pmnd.rs/react-three-fiber/api/canvas) to establish a
3D scene. Using this component will break context with parent components.

To link Motion 3D context with DOM Motion, for example to share a default
transition or link the [LayoutCamera](./react-three-fiber-layout-cameras) with
layout animations, the `MotionCanvas` component can be used instead.

    
    
    import { MotionConfig, motion } from "motion/react"
    import { MotionCanvas, motion as motion3d } from "framer-motion-3d"
    
    export function App() {
      return (
        <MotionConfig transition={{ type: "spring" }}>
          <motion.div animate={{ scale: 2 }}>
            <MotionCanvas>
              <motion3d.boxGeometry animate={{ x: 1 }} />
            </MotionCanvas>
          </motion.div>
        </MotionConfig>
      )
    }

It shares all the same props as R3F's `Canvas` component, with the omission of
`resize`, as `MotionCanvas` implements its own resize options to sync with
Framer Motion's layout animations.

It's also mandatory to enable [3D scenes within layout animations](./react-
three-fiber-layout-cameras).

React Three Fiber (R3F) uses the [Canvas
component](https://docs.pmnd.rs/react-three-fiber/api/canvas) to establish a
3D scene. Using this component will break context with parent components.

To link Motion 3D context with DOM Motion, for example to share a default
transition or link the [LayoutCamera](./react-three-fiber-layout-cameras) with
layout animations, the `MotionCanvas` component can be used instead.

    
    
    import { MotionConfig, motion } from "motion/react"
    import { MotionCanvas, motion as motion3d } from "framer-motion-3d"
    
    export function App() {
      return (
        <MotionConfig transition={{ type: "spring" }}>
          <motion.div animate={{ scale: 2 }}>
            <MotionCanvas>
              <motion3d.boxGeometry animate={{ x: 1 }} />
            </MotionCanvas>
          </motion.div>
        </MotionConfig>
      )
    }

It shares all the same props as R3F's `Canvas` component, with the omission of
`resize`, as `MotionCanvas` implements its own resize options to sync with
Framer Motion's layout animations.

It's also mandatory to enable [3D scenes within layout animations](./react-
three-fiber-layout-cameras).

React Three Fiber (R3F) uses the [Canvas
component](https://docs.pmnd.rs/react-three-fiber/api/canvas) to establish a
3D scene. Using this component will break context with parent components.

To link Motion 3D context with DOM Motion, for example to share a default
transition or link the [LayoutCamera](./react-three-fiber-layout-cameras) with
layout animations, the `MotionCanvas` component can be used instead.

    
    
    import { MotionConfig, motion } from "motion/react"
    import { MotionCanvas, motion as motion3d } from "framer-motion-3d"
    
    export function App() {
      return (
        <MotionConfig transition={{ type: "spring" }}>
          <motion.div animate={{ scale: 2 }}>
            <MotionCanvas>
              <motion3d.boxGeometry animate={{ x: 1 }} />
            </MotionCanvas>
          </motion.div>
        </MotionConfig>
      )
    }

It shares all the same props as R3F's `Canvas` component, with the omission of
`resize`, as `MotionCanvas` implements its own resize options to sync with
Framer Motion's layout animations.

It's also mandatory to enable [3D scenes within layout animations](./react-
three-fiber-layout-cameras).

[Layout cameras](./react-three-fiber-layout-cameras)

[Upgrade guide](./react-upgrade-guide)

