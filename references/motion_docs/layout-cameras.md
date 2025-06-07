# Layout cameras

Source: https://motion.dev/docs/react-three-fiber-layout-cameras

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

Layout cameras

# Layout cameras

Deprecated

Deprecated

`LayoutCamera` and `LayoutOrthographicCamera` allow us to involve React Three
Fiber scenes in Motion's [layout animations](./react-layout-animations).

## Usage

Motion's [layout animations](./react-layout-animations) work via the
`transform` style. A drawback to animating `width` and `height` via
`transform` is imagery can become distorted.

When involving a React Three Fiber scene into a layout animation, we can use
Motion's `LayoutCamera` and `LayoutOrthographicCamera` components to pre-
distort a 3D scene so that when the CSS `transform` is applied to the host
`canvas` element, it looks correct throughout the animation.

To implement a camera, we first nee to replace `Canvas` from `@react-
three/fiber` with [the ](./react-three-fiber-motion-
canvas)`[MotionCanvas](./react-three-fiber-motion-canvas)`[
component](./react-three-fiber-motion-canvas). Then, one of the camera
components can be added anywhere within the scene:

    
    
    import { MotionCanvas, LayoutCamera } from "framer-motion"
    
    function Scene() {
      <MotionCanvas>
        <LayoutCamera />
        <Box />
      </MotionCanvas>
    }

`LayoutCamera` provides a normal perspective camera:

Whereas `LayoutOrthographicCamera` provides an orthographic view:

## Props

Internally, `LayoutCamera` renders a `<motion.perspectiveCamera />` and
`LayoutOrthographicCamera` renders a `<motion.orthographicCamera />`
component, so they can accept all the usual React Three Fiber props like
`position` and `zoom`, as well as `motion` props like `initial` and `animate`.

    
    
    <LayoutCamera
      position={[0, 0, 5]}
      zoom={20}
      animate={{ zoom: 100 }}
      transition={{ duration: 2 }}
    />

`LayoutCamera` and `LayoutOrthographicCamera` allow us to involve React Three
Fiber scenes in Motion's [layout animations](./react-layout-animations).

## Usage

Motion's [layout animations](./react-layout-animations) work via the
`transform` style. A drawback to animating `width` and `height` via
`transform` is imagery can become distorted.

When involving a React Three Fiber scene into a layout animation, we can use
Motion's `LayoutCamera` and `LayoutOrthographicCamera` components to pre-
distort a 3D scene so that when the CSS `transform` is applied to the host
`canvas` element, it looks correct throughout the animation.

To implement a camera, we first nee to replace `Canvas` from `@react-
three/fiber` with [the ](./react-three-fiber-motion-
canvas)`[MotionCanvas](./react-three-fiber-motion-canvas)`[
component](./react-three-fiber-motion-canvas). Then, one of the camera
components can be added anywhere within the scene:

    
    
    import { MotionCanvas, LayoutCamera } from "framer-motion"
    
    function Scene() {
      <MotionCanvas>
        <LayoutCamera />
        <Box />
      </MotionCanvas>
    }

`LayoutCamera` provides a normal perspective camera:

Whereas `LayoutOrthographicCamera` provides an orthographic view:

## Props

Internally, `LayoutCamera` renders a `<motion.perspectiveCamera />` and
`LayoutOrthographicCamera` renders a `<motion.orthographicCamera />`
component, so they can accept all the usual React Three Fiber props like
`position` and `zoom`, as well as `motion` props like `initial` and `animate`.

    
    
    <LayoutCamera
      position={[0, 0, 5]}
      zoom={20}
      animate={{ zoom: 100 }}
      transition={{ duration: 2 }}
    />

`LayoutCamera` and `LayoutOrthographicCamera` allow us to involve React Three
Fiber scenes in Motion's [layout animations](./react-layout-animations).

## Usage

Motion's [layout animations](./react-layout-animations) work via the
`transform` style. A drawback to animating `width` and `height` via
`transform` is imagery can become distorted.

When involving a React Three Fiber scene into a layout animation, we can use
Motion's `LayoutCamera` and `LayoutOrthographicCamera` components to pre-
distort a 3D scene so that when the CSS `transform` is applied to the host
`canvas` element, it looks correct throughout the animation.

To implement a camera, we first nee to replace `Canvas` from `@react-
three/fiber` with [the ](./react-three-fiber-motion-
canvas)`[MotionCanvas](./react-three-fiber-motion-canvas)`[
component](./react-three-fiber-motion-canvas). Then, one of the camera
components can be added anywhere within the scene:

    
    
    import { MotionCanvas, LayoutCamera } from "framer-motion"
    
    function Scene() {
      <MotionCanvas>
        <LayoutCamera />
        <Box />
      </MotionCanvas>
    }

`LayoutCamera` provides a normal perspective camera:

Whereas `LayoutOrthographicCamera` provides an orthographic view:

## Props

Internally, `LayoutCamera` renders a `<motion.perspectiveCamera />` and
`LayoutOrthographicCamera` renders a `<motion.orthographicCamera />`
component, so they can accept all the usual React Three Fiber props like
`position` and `zoom`, as well as `motion` props like `initial` and `animate`.

    
    
    <LayoutCamera
      position={[0, 0, 5]}
      zoom={20}
      animate={{ zoom: 100 }}
      transition={{ duration: 2 }}
    />

[Motion for React Three Fiber](./react-three-fiber)

[MotionCanvas](./react-three-fiber-motion-canvas)

