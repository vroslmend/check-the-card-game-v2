# useDragControls

Source: https://motion.dev/docs/react-use-drag-controls

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

useDragControls

# useDragControls

Usually, dragging is initiated by pressing down on [a ](./react-
gestures#drag)`[motion](./react-gestures#drag)`[ component with a ](./react-
gestures#drag)`[drag](./react-gestures#drag)`[ prop](./react-gestures#drag)
and then moving the pointer.

For some use-cases, for example clicking at an arbitrary point on a video
scrubber, we might want to initiate that dragging from a different element.

With `useDragControls`, we can create a set of controls to manually start
dragging from any pointer event.

## Usage

Import `useDragControls` from Motion:

    
    
    import { useDragControls } from "motion/react"

`useDragControls` returns drag controls that can be passed to a draggable
`motion` component:

    
    
    const controls = useDragControls()
    
    return <motion.div drag dragControls={controls} />

Now we can start a drag session from another any element's `onPointerDown`
event via the `start` method.

    
    
    <div onPointerDown={event => controls.start(event)} />

### Touch support

To support touch screens, the triggering element should have the `touch-
action: none` style applied.

    
    
    <div onPointerDown={startDrag} style={{ touchAction: "none" }} />

### Snap to cursor

By default, the drag gesture will only apply **changes** to the pointer
position.

We can also make the `motion` component immediately snap to the cursor by
passing `snapToCursor: true` to the `start` method.

    
    
    controls.start(event, { snapToCursor: true })

### Disable automatic drag

With this configuration, the `motion` component will still automatically start
a drag gesture when it receives a `pointerdown` event itself.

We can stop this behaviour by passing it a `dragListener={false}` prop.

    
    
    <motion.div
      drag
      dragListener={false}
      dragControls={controls}
    />

Usually, dragging is initiated by pressing down on [a ](./react-
gestures#drag)`[motion](./react-gestures#drag)`[ component with a ](./react-
gestures#drag)`[drag](./react-gestures#drag)`[ prop](./react-gestures#drag)
and then moving the pointer.

For some use-cases, for example clicking at an arbitrary point on a video
scrubber, we might want to initiate that dragging from a different element.

With `useDragControls`, we can create a set of controls to manually start
dragging from any pointer event.

## Usage

Import `useDragControls` from Motion:

    
    
    import { useDragControls } from "motion/react"

`useDragControls` returns drag controls that can be passed to a draggable
`motion` component:

    
    
    const controls = useDragControls()
    
    return <motion.div drag dragControls={controls} />

Now we can start a drag session from another any element's `onPointerDown`
event via the `start` method.

    
    
    <div onPointerDown={event => controls.start(event)} />

### Touch support

To support touch screens, the triggering element should have the `touch-
action: none` style applied.

    
    
    <div onPointerDown={startDrag} style={{ touchAction: "none" }} />

### Snap to cursor

By default, the drag gesture will only apply **changes** to the pointer
position.

We can also make the `motion` component immediately snap to the cursor by
passing `snapToCursor: true` to the `start` method.

    
    
    controls.start(event, { snapToCursor: true })

### Disable automatic drag

With this configuration, the `motion` component will still automatically start
a drag gesture when it receives a `pointerdown` event itself.

We can stop this behaviour by passing it a `dragListener={false}` prop.

    
    
    <motion.div
      drag
      dragListener={false}
      dragControls={controls}
    />

Usually, dragging is initiated by pressing down on [a ](./react-
gestures#drag)`[motion](./react-gestures#drag)`[ component with a ](./react-
gestures#drag)`[drag](./react-gestures#drag)`[ prop](./react-gestures#drag)
and then moving the pointer.

For some use-cases, for example clicking at an arbitrary point on a video
scrubber, we might want to initiate that dragging from a different element.

With `useDragControls`, we can create a set of controls to manually start
dragging from any pointer event.

## Usage

Import `useDragControls` from Motion:

    
    
    import { useDragControls } from "motion/react"

`useDragControls` returns drag controls that can be passed to a draggable
`motion` component:

    
    
    const controls = useDragControls()
    
    return <motion.div drag dragControls={controls} />

Now we can start a drag session from another any element's `onPointerDown`
event via the `start` method.

    
    
    <div onPointerDown={event => controls.start(event)} />

### Touch support

To support touch screens, the triggering element should have the `touch-
action: none` style applied.

    
    
    <div onPointerDown={startDrag} style={{ touchAction: "none" }} />

### Snap to cursor

By default, the drag gesture will only apply **changes** to the pointer
position.

We can also make the `motion` component immediately snap to the cursor by
passing `snapToCursor: true` to the `start` method.

    
    
    controls.start(event, { snapToCursor: true })

### Disable automatic drag

With this configuration, the `motion` component will still automatically start
a drag gesture when it receives a `pointerdown` event itself.

We can stop this behaviour by passing it a `dragListener={false}` prop.

    
    
    <motion.div
      drag
      dragListener={false}
      dragControls={controls}
    />

[useAnimationFrame](./react-use-animation-frame)

[useInView](./react-use-in-view)

