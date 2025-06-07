# AnimatePresence

Source: https://motion.dev/docs/react-animate-presence

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

AnimatePresence

# AnimatePresence

`AnimatePresence` makes exit animations easy. By wrapping one or more
`[motion](./react-motion-component)`[ components](./react-motion-component)
with `AnimatePresence`, we gain access to the `exit` animation prop.

    
    
    <AnimatePresence>
      {show && <motion.div key="modal" exit={{ opacity: 0 }} />}
    </AnimatePresence>

## Usage

### Import

    
    
    import { AnimatePresence } from "motion/react"

### Exit animations

`AnimatePresence` works by detecting when its **direct children** are removed
from the React tree.

This can be due to a component mounting/remounting:

    
    
    <AnimatePresence>
      {show && <Modal key="modal" />}
    </AnimatePresence>

Its `key` changing:

    
    
    <AnimatePresence>
      <Slide key={activeItem.id} />
    </AnimatePresence>

Or when children in a list are added/removed:

    
    
    <AnimatePresence>
      {items.map(item => (
        <motion.li key={item.id} exit={{ opacity: 1 }} layout />
      ))}
    </AnimatePresence>

Any `motion` components within the exiting component will fire animations
defined on their `exit` props before the component is removed from the DOM.

    
    
    function Slide({ img, description }) {
      return (
        <motion.div exit={{ opacity: 0 }}>
          <img src={img.src} />
          <motion.p exit={{ y: 10 }}>{description}</motion.p>
        </motion.div>
      )
    }

**Note:** Direct children must each have a unique `key` prop so
`AnimatePresence` can track their presence in the tree.

Like `initial` and `animate`, `exit` can be defined either as an object of
values, or as a variant label.

    
    
    const modalVariants = {
      visible: { opacity: 1, transition: { when: "beforeChildren" } },
      hidden: { opacity: 0, transition: { when: "afterChildren" } }
    }
    
    function Modal({ children }) {
      return (
        <motion.div initial="hidden" animate="visible" exit="hidden">
          {children}
        </motion.div>
      )
    }

### Changing `key`

Changing a `key` prop makes React create an entirely new component. So by
changing the `key` of a single child of `AnimatePresence`, we can easily make
components like slideshows.

    
    
    export const Slideshow = ({ image }) => (
      <AnimatePresence>
        <motion.img
          key={image.src}
          src={image.src}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
        />
      </AnimatePresence>
    )

### Access presence state

Any child of `AnimatePresence` can access presence state with the
`useIsPresence` hook.

    
    
    import { useIsPresent } from "motion/react"
    
    function Component() {
      const isPresent = useIsPresent()
    
      return isPresent ? "Here!" : "Exiting..."
    }

This allows you to change content or styles when a component is no longer
rendered.

### Access presence data

When a component has been removed from the React tree, its props can no longer
be updated. We can use `AnimatePresence`'s `custom` prop to pass new data down
through the tree, even into exiting components.

    
    
    <AnimatePresence custom={swipeDirection}>
      <Slide key={activeSlideId}>

Then later we can extract that using `usePresenceData`.

    
    
    import { AnimatePresence, usePresenceData } from "motion/react"
    
    function Slide() {
      const isPresent = useIsPresent()
      const direction = usePresenceData()
    
      return (
        <motion.div exit={{ opacity: 0 }}>
          {isPresent ? "Here!" : "Exiting " + direction}
        </motion.div>
      )
    }

### Manual usage

It's also possible to manually tell `AnimatePresence` when a component is safe
to remove with the `usePresence` hook.

This returns both `isPresent` state and a callback, `safeToRemove`, that
should be called when you're ready to remove the component from the DOM (for
instance after a manual animation or other timeout).

    
    
    import { usePresence } from "motion/react"
    
    function Component() {
      const [isPresent, safeToRemove] = usePresence()
    
      useEffect(() => {
        // Remove from DOM 1000ms after being removed from React
        !isPresent && setTimeout(safeToRemove, 1000)
      }, [isPresent])
    
      return <div />
    }

### Propagate exit animations

By default, `AnimatePresence` controls the `exit` animations on all of its
children, **until** another `AnimatePresence` component is rendered.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence>
            {/*
              * When `show` becomes `false`, exit animations
              * on these children will not fire.
              */}
            {children}
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

By setting an `AnimatePresence` component's `propagate` prop to `true`, when
it's removed from another `AnimatePresence` it will fire all of **its**
children's exit animations.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence propagate>
            {/*
              * When `show` becomes `false`, exit animations
              * on these children **will** fire.
              */}
            {children}
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

## Props

### `initial`

By passing `initial={false}`, `AnimatePresence` will disable any initial
animations on children that are present when the component is first rendered.

    
    
    <AnimatePresence initial={false}>
      <Slide key={activeItem.id} />
    </AnimatePresence>

### `custom`

When a component is removed, there's no longer a chance to update its props
(because it's no longer in the React tree). Therefore we can't update its exit
animation with the same render that removed the component.

By passing a value through `AnimatePresence`'s `custom` prop, we can use
dynamic variants to change the `exit` animation.

    
    
    const variants = {
      hidden: (direction) => ({
        opacity: 0,
        x: direction === 1 ? -300 : 300
      }),
      visible: { opacity: 1, x: 0 }
    }
    
    export const Slideshow = ({ image, direction }) => (
      <AnimatePresence custom={direction}>
        <motion.img
          key={image.src}
          src={image.src}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        />
      </AnimatePresence>
    )

This data can be accessed by children via `usePresenceData`.

### `mode`

**Default:**`"sync"`

Decides how `AnimatePresence` handles entering and exiting children.

  * `"sync"`: Children animate in/out as soon as they're added/removed.

  * `"wait"`: The entering child will wait until the exiting child has animated out. **Note:** Currently only renders a single child at a time.

  * `"popLayout"`: Exiting children will be "popped" out of the page layout. This allows surrounding elements to move to their new layout immediately.

**Custom component note:** When using `popLayout` mode, any immediate child of
AnimatePresence that's a custom component **must** be wrapped in React's
`forwardRef` function, forwarding the provided `ref` to the DOM node you wish
to pop out of the layout.

### `onExitComplete`

Fires when all exiting nodes have completed animating out.

### `propagate`

**Default:** `false`

If set to `true`, exit animations on children will also trigger when this
`AnimatePresence` exits from a parent `AnimatePresence`.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence propagate>
            {/* This exit prop will now fire when show is false */}
            <motion.div exit={{ x: -100 }} />
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

## Troubleshooting

### Exit animations aren't working

Ensure all **immediate** children get a unique `key` prop that **remains the
same for that component every render**.

For instance, providing `index` as a `key` is **bad** because if the items
reorder then the `index` will not be matched to the `item`:

    
    
    <AnimatePresence>
      {items.map((item, index) => (
        <Component key={index} />
      ))}
    </AnimatePresence>

It's preferred to pass something that's unique to that item, for instance an
ID:

    
    
    <AnimatePresence>
      {items.map((item) => (
        <Component key={item.id} />
      ))}
    </AnimatePresence>

Also make sure `AnimatePresence` is **outside** of the code that unmounts the
element. If `AnimatePresence` itself unmounts, then it can't control exit
animations!

For example, this will **not work** :

    
    
    isVisible && (
      <AnimatePresence>
        <Component />
      </AnimatePresence>
    )

Instead, the conditional should be at the root of `AnimatePresence`:

    
    
    <AnimatePresence>
      {isVisible && <Component />}
    </AnimatePresence>

### Layout animations not working with `mode="sync"`

When mixing layout and exit animations, it might be necessary to wrap the
group in `[LayoutGroup](./react-layout-group)` to ensure that components
outside of `AnimatePresence` know when to perform a layout animation.

    
    
    <LayoutGroup>
      <motion.ul layout>
        <AnimatePresence>
          {items.map(item => (
            <motion.li layout key={item.id} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </LayoutGroup>

### Layout animations not working with `mode="popLayout"`

When any HTML element has an active `transform` it temporarily becomes the
[offset parent](https://developer.mozilla.org/en-
US/docs/Web/API/HTMLElement/offsetParent) of its children. This can cause
children with `position: "absolute"` not to appear where you expect.  
  
`mode="popLayout"` works by using `position: "absolute"`. So to ensure
consistent and expected positioning during a layout animation, ensure that the
animating parent has a `position` other than `"static"`.

    
    
    <motion.ul layout style={{ position: "relative" }}>
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <motion.li layout key={item.id} />
        ))}
      </AnimatePresence>
    </motion.ul>

`AnimatePresence` makes exit animations easy. By wrapping one or more
`[motion](./react-motion-component)`[ components](./react-motion-component)
with `AnimatePresence`, we gain access to the `exit` animation prop.

    
    
    <AnimatePresence>
      {show && <motion.div key="modal" exit={{ opacity: 0 }} />}
    </AnimatePresence>

## Usage

### Import

    
    
    import { AnimatePresence } from "motion/react"

### Exit animations

`AnimatePresence` works by detecting when its **direct children** are removed
from the React tree.

This can be due to a component mounting/remounting:

    
    
    <AnimatePresence>
      {show && <Modal key="modal" />}
    </AnimatePresence>

Its `key` changing:

    
    
    <AnimatePresence>
      <Slide key={activeItem.id} />
    </AnimatePresence>

Or when children in a list are added/removed:

    
    
    <AnimatePresence>
      {items.map(item => (
        <motion.li key={item.id} exit={{ opacity: 1 }} layout />
      ))}
    </AnimatePresence>

Any `motion` components within the exiting component will fire animations
defined on their `exit` props before the component is removed from the DOM.

    
    
    function Slide({ img, description }) {
      return (
        <motion.div exit={{ opacity: 0 }}>
          <img src={img.src} />
          <motion.p exit={{ y: 10 }}>{description}</motion.p>
        </motion.div>
      )
    }

**Note:** Direct children must each have a unique `key` prop so
`AnimatePresence` can track their presence in the tree.

Like `initial` and `animate`, `exit` can be defined either as an object of
values, or as a variant label.

    
    
    const modalVariants = {
      visible: { opacity: 1, transition: { when: "beforeChildren" } },
      hidden: { opacity: 0, transition: { when: "afterChildren" } }
    }
    
    function Modal({ children }) {
      return (
        <motion.div initial="hidden" animate="visible" exit="hidden">
          {children}
        </motion.div>
      )
    }

### Changing `key`

Changing a `key` prop makes React create an entirely new component. So by
changing the `key` of a single child of `AnimatePresence`, we can easily make
components like slideshows.

    
    
    export const Slideshow = ({ image }) => (
      <AnimatePresence>
        <motion.img
          key={image.src}
          src={image.src}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
        />
      </AnimatePresence>
    )

### Access presence state

Any child of `AnimatePresence` can access presence state with the
`useIsPresence` hook.

    
    
    import { useIsPresent } from "motion/react"
    
    function Component() {
      const isPresent = useIsPresent()
    
      return isPresent ? "Here!" : "Exiting..."
    }

This allows you to change content or styles when a component is no longer
rendered.

### Access presence data

When a component has been removed from the React tree, its props can no longer
be updated. We can use `AnimatePresence`'s `custom` prop to pass new data down
through the tree, even into exiting components.

    
    
    <AnimatePresence custom={swipeDirection}>
      <Slide key={activeSlideId}>

Then later we can extract that using `usePresenceData`.

    
    
    import { AnimatePresence, usePresenceData } from "motion/react"
    
    function Slide() {
      const isPresent = useIsPresent()
      const direction = usePresenceData()
    
      return (
        <motion.div exit={{ opacity: 0 }}>
          {isPresent ? "Here!" : "Exiting " + direction}
        </motion.div>
      )
    }

### Manual usage

It's also possible to manually tell `AnimatePresence` when a component is safe
to remove with the `usePresence` hook.

This returns both `isPresent` state and a callback, `safeToRemove`, that
should be called when you're ready to remove the component from the DOM (for
instance after a manual animation or other timeout).

    
    
    import { usePresence } from "motion/react"
    
    function Component() {
      const [isPresent, safeToRemove] = usePresence()
    
      useEffect(() => {
        // Remove from DOM 1000ms after being removed from React
        !isPresent && setTimeout(safeToRemove, 1000)
      }, [isPresent])
    
      return <div />
    }

### Propagate exit animations

By default, `AnimatePresence` controls the `exit` animations on all of its
children, **until** another `AnimatePresence` component is rendered.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence>
            {/*
              * When `show` becomes `false`, exit animations
              * on these children will not fire.
              */}
            {children}
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

By setting an `AnimatePresence` component's `propagate` prop to `true`, when
it's removed from another `AnimatePresence` it will fire all of **its**
children's exit animations.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence propagate>
            {/*
              * When `show` becomes `false`, exit animations
              * on these children **will** fire.
              */}
            {children}
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

## Props

### `initial`

By passing `initial={false}`, `AnimatePresence` will disable any initial
animations on children that are present when the component is first rendered.

    
    
    <AnimatePresence initial={false}>
      <Slide key={activeItem.id} />
    </AnimatePresence>

### `custom`

When a component is removed, there's no longer a chance to update its props
(because it's no longer in the React tree). Therefore we can't update its exit
animation with the same render that removed the component.

By passing a value through `AnimatePresence`'s `custom` prop, we can use
dynamic variants to change the `exit` animation.

    
    
    const variants = {
      hidden: (direction) => ({
        opacity: 0,
        x: direction === 1 ? -300 : 300
      }),
      visible: { opacity: 1, x: 0 }
    }
    
    export const Slideshow = ({ image, direction }) => (
      <AnimatePresence custom={direction}>
        <motion.img
          key={image.src}
          src={image.src}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        />
      </AnimatePresence>
    )

This data can be accessed by children via `usePresenceData`.

### `mode`

**Default:**`"sync"`

Decides how `AnimatePresence` handles entering and exiting children.

  * `"sync"`: Children animate in/out as soon as they're added/removed.

  * `"wait"`: The entering child will wait until the exiting child has animated out. **Note:** Currently only renders a single child at a time.

  * `"popLayout"`: Exiting children will be "popped" out of the page layout. This allows surrounding elements to move to their new layout immediately.

**Custom component note:** When using `popLayout` mode, any immediate child of
AnimatePresence that's a custom component **must** be wrapped in React's
`forwardRef` function, forwarding the provided `ref` to the DOM node you wish
to pop out of the layout.

### `onExitComplete`

Fires when all exiting nodes have completed animating out.

### `propagate`

**Default:** `false`

If set to `true`, exit animations on children will also trigger when this
`AnimatePresence` exits from a parent `AnimatePresence`.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence propagate>
            {/* This exit prop will now fire when show is false */}
            <motion.div exit={{ x: -100 }} />
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

## Troubleshooting

### Exit animations aren't working

Ensure all **immediate** children get a unique `key` prop that **remains the
same for that component every render**.

For instance, providing `index` as a `key` is **bad** because if the items
reorder then the `index` will not be matched to the `item`:

    
    
    <AnimatePresence>
      {items.map((item, index) => (
        <Component key={index} />
      ))}
    </AnimatePresence>

It's preferred to pass something that's unique to that item, for instance an
ID:

    
    
    <AnimatePresence>
      {items.map((item) => (
        <Component key={item.id} />
      ))}
    </AnimatePresence>

Also make sure `AnimatePresence` is **outside** of the code that unmounts the
element. If `AnimatePresence` itself unmounts, then it can't control exit
animations!

For example, this will **not work** :

    
    
    isVisible && (
      <AnimatePresence>
        <Component />
      </AnimatePresence>
    )

Instead, the conditional should be at the root of `AnimatePresence`:

    
    
    <AnimatePresence>
      {isVisible && <Component />}
    </AnimatePresence>

### Layout animations not working with `mode="sync"`

When mixing layout and exit animations, it might be necessary to wrap the
group in `[LayoutGroup](./react-layout-group)` to ensure that components
outside of `AnimatePresence` know when to perform a layout animation.

    
    
    <LayoutGroup>
      <motion.ul layout>
        <AnimatePresence>
          {items.map(item => (
            <motion.li layout key={item.id} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </LayoutGroup>

### Layout animations not working with `mode="popLayout"`

When any HTML element has an active `transform` it temporarily becomes the
[offset parent](https://developer.mozilla.org/en-
US/docs/Web/API/HTMLElement/offsetParent) of its children. This can cause
children with `position: "absolute"` not to appear where you expect.  
  
`mode="popLayout"` works by using `position: "absolute"`. So to ensure
consistent and expected positioning during a layout animation, ensure that the
animating parent has a `position` other than `"static"`.

    
    
    <motion.ul layout style={{ position: "relative" }}>
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <motion.li layout key={item.id} />
        ))}
      </AnimatePresence>
    </motion.ul>

`AnimatePresence` makes exit animations easy. By wrapping one or more
`[motion](./react-motion-component)`[ components](./react-motion-component)
with `AnimatePresence`, we gain access to the `exit` animation prop.

    
    
    <AnimatePresence>
      {show && <motion.div key="modal" exit={{ opacity: 0 }} />}
    </AnimatePresence>

## Usage

### Import

    
    
    import { AnimatePresence } from "motion/react"

### Exit animations

`AnimatePresence` works by detecting when its **direct children** are removed
from the React tree.

This can be due to a component mounting/remounting:

    
    
    <AnimatePresence>
      {show && <Modal key="modal" />}
    </AnimatePresence>

Its `key` changing:

    
    
    <AnimatePresence>
      <Slide key={activeItem.id} />
    </AnimatePresence>

Or when children in a list are added/removed:

    
    
    <AnimatePresence>
      {items.map(item => (
        <motion.li key={item.id} exit={{ opacity: 1 }} layout />
      ))}
    </AnimatePresence>

Any `motion` components within the exiting component will fire animations
defined on their `exit` props before the component is removed from the DOM.

    
    
    function Slide({ img, description }) {
      return (
        <motion.div exit={{ opacity: 0 }}>
          <img src={img.src} />
          <motion.p exit={{ y: 10 }}>{description}</motion.p>
        </motion.div>
      )
    }

**Note:** Direct children must each have a unique `key` prop so
`AnimatePresence` can track their presence in the tree.

Like `initial` and `animate`, `exit` can be defined either as an object of
values, or as a variant label.

    
    
    const modalVariants = {
      visible: { opacity: 1, transition: { when: "beforeChildren" } },
      hidden: { opacity: 0, transition: { when: "afterChildren" } }
    }
    
    function Modal({ children }) {
      return (
        <motion.div initial="hidden" animate="visible" exit="hidden">
          {children}
        </motion.div>
      )
    }

### Changing `key`

Changing a `key` prop makes React create an entirely new component. So by
changing the `key` of a single child of `AnimatePresence`, we can easily make
components like slideshows.

    
    
    export const Slideshow = ({ image }) => (
      <AnimatePresence>
        <motion.img
          key={image.src}
          src={image.src}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
        />
      </AnimatePresence>
    )

### Access presence state

Any child of `AnimatePresence` can access presence state with the
`useIsPresence` hook.

    
    
    import { useIsPresent } from "motion/react"
    
    function Component() {
      const isPresent = useIsPresent()
    
      return isPresent ? "Here!" : "Exiting..."
    }

This allows you to change content or styles when a component is no longer
rendered.

### Access presence data

When a component has been removed from the React tree, its props can no longer
be updated. We can use `AnimatePresence`'s `custom` prop to pass new data down
through the tree, even into exiting components.

    
    
    <AnimatePresence custom={swipeDirection}>
      <Slide key={activeSlideId}>

Then later we can extract that using `usePresenceData`.

    
    
    import { AnimatePresence, usePresenceData } from "motion/react"
    
    function Slide() {
      const isPresent = useIsPresent()
      const direction = usePresenceData()
    
      return (
        <motion.div exit={{ opacity: 0 }}>
          {isPresent ? "Here!" : "Exiting " + direction}
        </motion.div>
      )
    }

### Manual usage

It's also possible to manually tell `AnimatePresence` when a component is safe
to remove with the `usePresence` hook.

This returns both `isPresent` state and a callback, `safeToRemove`, that
should be called when you're ready to remove the component from the DOM (for
instance after a manual animation or other timeout).

    
    
    import { usePresence } from "motion/react"
    
    function Component() {
      const [isPresent, safeToRemove] = usePresence()
    
      useEffect(() => {
        // Remove from DOM 1000ms after being removed from React
        !isPresent && setTimeout(safeToRemove, 1000)
      }, [isPresent])
    
      return <div />
    }

### Propagate exit animations

By default, `AnimatePresence` controls the `exit` animations on all of its
children, **until** another `AnimatePresence` component is rendered.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence>
            {/*
              * When `show` becomes `false`, exit animations
              * on these children will not fire.
              */}
            {children}
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

By setting an `AnimatePresence` component's `propagate` prop to `true`, when
it's removed from another `AnimatePresence` it will fire all of **its**
children's exit animations.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence propagate>
            {/*
              * When `show` becomes `false`, exit animations
              * on these children **will** fire.
              */}
            {children}
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

## Props

### `initial`

By passing `initial={false}`, `AnimatePresence` will disable any initial
animations on children that are present when the component is first rendered.

    
    
    <AnimatePresence initial={false}>
      <Slide key={activeItem.id} />
    </AnimatePresence>

### `custom`

When a component is removed, there's no longer a chance to update its props
(because it's no longer in the React tree). Therefore we can't update its exit
animation with the same render that removed the component.

By passing a value through `AnimatePresence`'s `custom` prop, we can use
dynamic variants to change the `exit` animation.

    
    
    const variants = {
      hidden: (direction) => ({
        opacity: 0,
        x: direction === 1 ? -300 : 300
      }),
      visible: { opacity: 1, x: 0 }
    }
    
    export const Slideshow = ({ image, direction }) => (
      <AnimatePresence custom={direction}>
        <motion.img
          key={image.src}
          src={image.src}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        />
      </AnimatePresence>
    )

This data can be accessed by children via `usePresenceData`.

### `mode`

**Default:**`"sync"`

Decides how `AnimatePresence` handles entering and exiting children.

  * `"sync"`: Children animate in/out as soon as they're added/removed.

  * `"wait"`: The entering child will wait until the exiting child has animated out. **Note:** Currently only renders a single child at a time.

  * `"popLayout"`: Exiting children will be "popped" out of the page layout. This allows surrounding elements to move to their new layout immediately.

**Custom component note:** When using `popLayout` mode, any immediate child of
AnimatePresence that's a custom component **must** be wrapped in React's
`forwardRef` function, forwarding the provided `ref` to the DOM node you wish
to pop out of the layout.

### `onExitComplete`

Fires when all exiting nodes have completed animating out.

### `propagate`

**Default:** `false`

If set to `true`, exit animations on children will also trigger when this
`AnimatePresence` exits from a parent `AnimatePresence`.

    
    
    <AnimatePresence>
      {show ? (
        <motion.section exit={{ opacity: 0 }}>
          <AnimatePresence propagate>
            {/* This exit prop will now fire when show is false */}
            <motion.div exit={{ x: -100 }} />
          </AnimatePresence>
        </motion.section>
      ) : null}
    </AnimatePresence>

## Troubleshooting

### Exit animations aren't working

Ensure all **immediate** children get a unique `key` prop that **remains the
same for that component every render**.

For instance, providing `index` as a `key` is **bad** because if the items
reorder then the `index` will not be matched to the `item`:

    
    
    <AnimatePresence>
      {items.map((item, index) => (
        <Component key={index} />
      ))}
    </AnimatePresence>

It's preferred to pass something that's unique to that item, for instance an
ID:

    
    
    <AnimatePresence>
      {items.map((item) => (
        <Component key={item.id} />
      ))}
    </AnimatePresence>

Also make sure `AnimatePresence` is **outside** of the code that unmounts the
element. If `AnimatePresence` itself unmounts, then it can't control exit
animations!

For example, this will **not work** :

    
    
    isVisible && (
      <AnimatePresence>
        <Component />
      </AnimatePresence>
    )

Instead, the conditional should be at the root of `AnimatePresence`:

    
    
    <AnimatePresence>
      {isVisible && <Component />}
    </AnimatePresence>

### Layout animations not working with `mode="sync"`

When mixing layout and exit animations, it might be necessary to wrap the
group in `[LayoutGroup](./react-layout-group)` to ensure that components
outside of `AnimatePresence` know when to perform a layout animation.

    
    
    <LayoutGroup>
      <motion.ul layout>
        <AnimatePresence>
          {items.map(item => (
            <motion.li layout key={item.id} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </LayoutGroup>

### Layout animations not working with `mode="popLayout"`

When any HTML element has an active `transform` it temporarily becomes the
[offset parent](https://developer.mozilla.org/en-
US/docs/Web/API/HTMLElement/offsetParent) of its children. This can cause
children with `position: "absolute"` not to appear where you expect.  
  
`mode="popLayout"` works by using `position: "absolute"`. So to ensure
consistent and expected positioning during a layout animation, ensure that the
animating parent has a `position` other than `"static"`.

    
    
    <motion.ul layout style={{ position: "relative" }}>
      <AnimatePresence mode="popLayout">
        {items.map(item => (
          <motion.li layout key={item.id} />
        ))}
      </AnimatePresence>
    </motion.ul>

AnimatePresence

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

[AnimateNumber](./react-animate-number)

[Cursor](./cursor)

