# Gestures

Source: https://motion.dev/docs/react-gestures

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

Gestures

# Gestures

Motion extends React's basic set of event listeners with a simple yet powerful
set of UI gestures.

The `motion` component currently has support for **hover** , **tap** , **pan**
, **drag** and **inView**.

Each gesture has both a set of event listeners and a `while-` animation prop.

## Animation props

`motion` components provide multiple gesture animation props: `whileHover`,
`whileTap`, `whileFocus`, `whileDrag` and `[whileInView](../)`. These can
define animation targets to temporarily animate to while a gesture is active.

    
    
    <motion.button
      whileHover={{
        scale: 1.2,
        transition: { duration: 1 },
      }}
      whileTap={{ scale: 0.9 }}
    />

All props can be set either as a target of values to animate to, or the name
of any variants defined via the `variants` prop. Variants will flow down
through children as normal.

    
    
    <motion.button
      whileTap="tap"
      whileHover="hover"
      variants={buttonVariants}
    >
      <svg>
        <motion.path variants={iconVariants} />
      </svg>
    </motion.button>

## Gestures

### Hover

The hover gesture detects when a pointer hovers over or leaves a component.

It differs from `onMouseEnter` and `onMouseLeave` in that hover is guaranteed
to only fire as a result of actual mouse events (as opposed to browser-
generated mice events emulated from touch input).

    
    
    <motion.a
      whileHover={{ scale: 1.2 }}
      onHoverStart={event => {}}
      onHoverEnd={event => {}}
    />

### Tap

The tap gesture detects when the **primary pointer** (like a left click or
first touch point) presses down and releases on the same component.

    
    
    <motion.button whileTap={{ scale: 0.9, rotate: 3 }} />

It will fire a `tap` event when the tap or click ends on the same component it
started on, and a `tapCancel` event if the tap or click ends outside the
component.

If the tappable component is a child of a draggable component, it'll
automatically cancel the tap gesture if the pointer moves further than 3
pixels during the gesture.

#### Accessibility

Elements with tap events are keyboard-accessible.

Any element with a tap prop will be able to receive focus and `Enter` can be
used to trigger tap events on focused elements.

  * Pressing `Enter` down will trigger `onTapStart` and `whileTap`

  * Releasing `Enter` will trigger `onTap`

  * If the element loses focus before `Enter` is released, `onTapCancel` will fire.

### Pan

The pan gesture recognises when a pointer presses down on a component and
moves further than 3 pixels. The pan gesture is ended when the pointer is
released.

    
    
    <motion.div onPan={(e, pointInfo) => {}} />

Pan doesn't currently have an associated `while-` prop.

**Note:** For pan gestures to work correctly with touch input, the element
needs touch scrolling to be disabled on either x/y or both axis with the
`[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-
action)` CSS rule.

### Drag

The drag gesture applies pointer movement to the x and/or y axis of the
component.

    
    
    <motion.div drag whileDrag={{ scale: 1.2, backgroundColor: "#f00" }} />

By default, when the drag ends the element will perform an inertia animation
with the ending velocity.

This can be disabled by setting `dragMomentum` to `false`, or changed via the
`dragTransition` prop.

#### Constraints

It's also possible to set `dragConstraints`, either as an object with `top`,
`left`, `right`, and `bottom` values, measured in pixels.

    
    
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 300 }}
    />

Or, it can accept a `ref` to another component created with React's `useRef`
hook. This `ref` should be passed both to the draggable component's
`dragConstraints` prop, and the `ref` of the component you want to use as
constraints.

    
    
    const MyComponent = () => {
      const constraintsRef = useRef(null)
    
      return (
         <motion.div ref={constraintsRef}>
             <motion.div drag dragConstraints={constraintsRef} />
         </motion.div>
      )
    }

By default, dragging the element outside the constraints will tug with some
elasticity. This can be changed by setting `dragElastic` to a value between
`0` and `1`, where `0` equals no motion and `1` equals full motion outside the
constraints.

#### Direction locking

It's possible to lock an element to the first axis it's dragged on by setting
`dragDirectionLock`.

    
    
    <motion.div
      drag
      dragDirectionLock
      onDirectionLock={callback}
    />

Each time the drag gesture starts, the direction of pointer travel will be
detected and the element will be draggable only on this axis.

### Focus

The focus gesture detects when a component gains or loses focus by the same
rules as the [CSS :focus-visible selector](https://developer.mozilla.org/en-
US/docs/Web/CSS/:focus-visible).

Typically, this is when an `input` receives focus by any means, and when other
elements receive focus by accessible means (like via keyboard navigation).

    
    
    <motion.a whileFocus={{ scale: 1.2 }} href="#" />

## Event propagation

Children can stop pointer events propagating to parent `motion` components
using the `Capture` React props.

For instance, a child can stop drag and tap gestures and their related `while`
animations from firing on parents by passing `e.stopPropagation()` to
`onPointerDownCapture`.

    
    
    <motion.div whileTap={{ scale: 2 }}>
      <button onPointerDownCapture={e => e.stopPropagation()} />
    </motion.div>

## Note: SVG filters

Gestures aren't recognised on SVG `filter` components, as these elements don't
have a physical presence and therefore don't receive events.

You can instead add `while-` props and event handlers to a parent and use
variants to animate these elements.

    
    
    const MyComponent = () => {
      return (
        <motion.svg whileHover="hover">
          <filter id="blur">
            <motion.feGaussianBlur
              stdDeviation={0}
              variants={{ hover: { stdDeviation: 2 } }}
            />
          </filter>
        </motion.svg>
      )
    }

Motion extends React's basic set of event listeners with a simple yet powerful
set of UI gestures.

The `motion` component currently has support for **hover** , **tap** , **pan**
, **drag** and **inView**.

Each gesture has both a set of event listeners and a `while-` animation prop.

## Animation props

`motion` components provide multiple gesture animation props: `whileHover`,
`whileTap`, `whileFocus`, `whileDrag` and `[whileInView](../)`. These can
define animation targets to temporarily animate to while a gesture is active.

    
    
    <motion.button
      whileHover={{
        scale: 1.2,
        transition: { duration: 1 },
      }}
      whileTap={{ scale: 0.9 }}
    />

All props can be set either as a target of values to animate to, or the name
of any variants defined via the `variants` prop. Variants will flow down
through children as normal.

    
    
    <motion.button
      whileTap="tap"
      whileHover="hover"
      variants={buttonVariants}
    >
      <svg>
        <motion.path variants={iconVariants} />
      </svg>
    </motion.button>

## Gestures

### Hover

The hover gesture detects when a pointer hovers over or leaves a component.

It differs from `onMouseEnter` and `onMouseLeave` in that hover is guaranteed
to only fire as a result of actual mouse events (as opposed to browser-
generated mice events emulated from touch input).

    
    
    <motion.a
      whileHover={{ scale: 1.2 }}
      onHoverStart={event => {}}
      onHoverEnd={event => {}}
    />

### Tap

The tap gesture detects when the **primary pointer** (like a left click or
first touch point) presses down and releases on the same component.

    
    
    <motion.button whileTap={{ scale: 0.9, rotate: 3 }} />

It will fire a `tap` event when the tap or click ends on the same component it
started on, and a `tapCancel` event if the tap or click ends outside the
component.

If the tappable component is a child of a draggable component, it'll
automatically cancel the tap gesture if the pointer moves further than 3
pixels during the gesture.

#### Accessibility

Elements with tap events are keyboard-accessible.

Any element with a tap prop will be able to receive focus and `Enter` can be
used to trigger tap events on focused elements.

  * Pressing `Enter` down will trigger `onTapStart` and `whileTap`

  * Releasing `Enter` will trigger `onTap`

  * If the element loses focus before `Enter` is released, `onTapCancel` will fire.

### Pan

The pan gesture recognises when a pointer presses down on a component and
moves further than 3 pixels. The pan gesture is ended when the pointer is
released.

    
    
    <motion.div onPan={(e, pointInfo) => {}} />

Pan doesn't currently have an associated `while-` prop.

**Note:** For pan gestures to work correctly with touch input, the element
needs touch scrolling to be disabled on either x/y or both axis with the
`[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-
action)` CSS rule.

### Drag

The drag gesture applies pointer movement to the x and/or y axis of the
component.

    
    
    <motion.div drag whileDrag={{ scale: 1.2, backgroundColor: "#f00" }} />

By default, when the drag ends the element will perform an inertia animation
with the ending velocity.

This can be disabled by setting `dragMomentum` to `false`, or changed via the
`dragTransition` prop.

#### Constraints

It's also possible to set `dragConstraints`, either as an object with `top`,
`left`, `right`, and `bottom` values, measured in pixels.

    
    
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 300 }}
    />

Or, it can accept a `ref` to another component created with React's `useRef`
hook. This `ref` should be passed both to the draggable component's
`dragConstraints` prop, and the `ref` of the component you want to use as
constraints.

    
    
    const MyComponent = () => {
      const constraintsRef = useRef(null)
    
      return (
         <motion.div ref={constraintsRef}>
             <motion.div drag dragConstraints={constraintsRef} />
         </motion.div>
      )
    }

By default, dragging the element outside the constraints will tug with some
elasticity. This can be changed by setting `dragElastic` to a value between
`0` and `1`, where `0` equals no motion and `1` equals full motion outside the
constraints.

#### Direction locking

It's possible to lock an element to the first axis it's dragged on by setting
`dragDirectionLock`.

    
    
    <motion.div
      drag
      dragDirectionLock
      onDirectionLock={callback}
    />

Each time the drag gesture starts, the direction of pointer travel will be
detected and the element will be draggable only on this axis.

### Focus

The focus gesture detects when a component gains or loses focus by the same
rules as the [CSS :focus-visible selector](https://developer.mozilla.org/en-
US/docs/Web/CSS/:focus-visible).

Typically, this is when an `input` receives focus by any means, and when other
elements receive focus by accessible means (like via keyboard navigation).

    
    
    <motion.a whileFocus={{ scale: 1.2 }} href="#" />

## Event propagation

Children can stop pointer events propagating to parent `motion` components
using the `Capture` React props.

For instance, a child can stop drag and tap gestures and their related `while`
animations from firing on parents by passing `e.stopPropagation()` to
`onPointerDownCapture`.

    
    
    <motion.div whileTap={{ scale: 2 }}>
      <button onPointerDownCapture={e => e.stopPropagation()} />
    </motion.div>

## Note: SVG filters

Gestures aren't recognised on SVG `filter` components, as these elements don't
have a physical presence and therefore don't receive events.

You can instead add `while-` props and event handlers to a parent and use
variants to animate these elements.

    
    
    const MyComponent = () => {
      return (
        <motion.svg whileHover="hover">
          <filter id="blur">
            <motion.feGaussianBlur
              stdDeviation={0}
              variants={{ hover: { stdDeviation: 2 } }}
            />
          </filter>
        </motion.svg>
      )
    }

Motion extends React's basic set of event listeners with a simple yet powerful
set of UI gestures.

The `motion` component currently has support for **hover** , **tap** , **pan**
, **drag** and **inView**.

Each gesture has both a set of event listeners and a `while-` animation prop.

## Animation props

`motion` components provide multiple gesture animation props: `whileHover`,
`whileTap`, `whileFocus`, `whileDrag` and `[whileInView](../)`. These can
define animation targets to temporarily animate to while a gesture is active.

    
    
    <motion.button
      whileHover={{
        scale: 1.2,
        transition: { duration: 1 },
      }}
      whileTap={{ scale: 0.9 }}
    />

All props can be set either as a target of values to animate to, or the name
of any variants defined via the `variants` prop. Variants will flow down
through children as normal.

    
    
    <motion.button
      whileTap="tap"
      whileHover="hover"
      variants={buttonVariants}
    >
      <svg>
        <motion.path variants={iconVariants} />
      </svg>
    </motion.button>

## Gestures

### Hover

The hover gesture detects when a pointer hovers over or leaves a component.

It differs from `onMouseEnter` and `onMouseLeave` in that hover is guaranteed
to only fire as a result of actual mouse events (as opposed to browser-
generated mice events emulated from touch input).

    
    
    <motion.a
      whileHover={{ scale: 1.2 }}
      onHoverStart={event => {}}
      onHoverEnd={event => {}}
    />

### Tap

The tap gesture detects when the **primary pointer** (like a left click or
first touch point) presses down and releases on the same component.

    
    
    <motion.button whileTap={{ scale: 0.9, rotate: 3 }} />

It will fire a `tap` event when the tap or click ends on the same component it
started on, and a `tapCancel` event if the tap or click ends outside the
component.

If the tappable component is a child of a draggable component, it'll
automatically cancel the tap gesture if the pointer moves further than 3
pixels during the gesture.

#### Accessibility

Elements with tap events are keyboard-accessible.

Any element with a tap prop will be able to receive focus and `Enter` can be
used to trigger tap events on focused elements.

  * Pressing `Enter` down will trigger `onTapStart` and `whileTap`

  * Releasing `Enter` will trigger `onTap`

  * If the element loses focus before `Enter` is released, `onTapCancel` will fire.

### Pan

The pan gesture recognises when a pointer presses down on a component and
moves further than 3 pixels. The pan gesture is ended when the pointer is
released.

    
    
    <motion.div onPan={(e, pointInfo) => {}} />

Pan doesn't currently have an associated `while-` prop.

**Note:** For pan gestures to work correctly with touch input, the element
needs touch scrolling to be disabled on either x/y or both axis with the
`[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-
action)` CSS rule.

### Drag

The drag gesture applies pointer movement to the x and/or y axis of the
component.

    
    
    <motion.div drag whileDrag={{ scale: 1.2, backgroundColor: "#f00" }} />

By default, when the drag ends the element will perform an inertia animation
with the ending velocity.

This can be disabled by setting `dragMomentum` to `false`, or changed via the
`dragTransition` prop.

#### Constraints

It's also possible to set `dragConstraints`, either as an object with `top`,
`left`, `right`, and `bottom` values, measured in pixels.

    
    
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 300 }}
    />

Or, it can accept a `ref` to another component created with React's `useRef`
hook. This `ref` should be passed both to the draggable component's
`dragConstraints` prop, and the `ref` of the component you want to use as
constraints.

    
    
    const MyComponent = () => {
      const constraintsRef = useRef(null)
    
      return (
         <motion.div ref={constraintsRef}>
             <motion.div drag dragConstraints={constraintsRef} />
         </motion.div>
      )
    }

By default, dragging the element outside the constraints will tug with some
elasticity. This can be changed by setting `dragElastic` to a value between
`0` and `1`, where `0` equals no motion and `1` equals full motion outside the
constraints.

#### Direction locking

It's possible to lock an element to the first axis it's dragged on by setting
`dragDirectionLock`.

    
    
    <motion.div
      drag
      dragDirectionLock
      onDirectionLock={callback}
    />

Each time the drag gesture starts, the direction of pointer travel will be
detected and the element will be draggable only on this axis.

### Focus

The focus gesture detects when a component gains or loses focus by the same
rules as the [CSS :focus-visible selector](https://developer.mozilla.org/en-
US/docs/Web/CSS/:focus-visible).

Typically, this is when an `input` receives focus by any means, and when other
elements receive focus by accessible means (like via keyboard navigation).

    
    
    <motion.a whileFocus={{ scale: 1.2 }} href="#" />

## Event propagation

Children can stop pointer events propagating to parent `motion` components
using the `Capture` React props.

For instance, a child can stop drag and tap gestures and their related `while`
animations from firing on parents by passing `e.stopPropagation()` to
`onPointerDownCapture`.

    
    
    <motion.div whileTap={{ scale: 2 }}>
      <button onPointerDownCapture={e => e.stopPropagation()} />
    </motion.div>

## Note: SVG filters

Gestures aren't recognised on SVG `filter` components, as these elements don't
have a physical presence and therefore don't receive events.

You can instead add `while-` props and event handlers to a parent and use
variants to animate these elements.

    
    
    const MyComponent = () => {
      return (
        <motion.svg whileHover="hover">
          <filter id="blur">
            <motion.feGaussianBlur
              stdDeviation={0}
              variants={{ hover: { stdDeviation: 2 } }}
            />
          </filter>
        </motion.svg>
      )
    }

Gestures

Examples

## Go beyond the basics

[Motion+](../plus) is a one-time fee, lifetime membership.

As well as premium Motion features, early access content, and a private
Discord community, you'll unlock access to the source code of 90+ premium
examples that take the APIs on this page to the next level.

Loading...

Loading...

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[React animation](./react-animation)

[Layout animations](./react-layout-animations)

