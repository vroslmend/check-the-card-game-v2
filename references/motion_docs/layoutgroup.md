# LayoutGroup

Source: https://motion.dev/docs/react-layout-group

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

LayoutGroup

# LayoutGroup

`motion` components with a `layout` prop will detect and animate layout
changes every time they commit a React re-render, or their `layoutDependency`
prop changes.

`LayoutGroup` is used to group components that might not render together but
do affect each-other's state.

## Usage

Take these accordion items that each handle their own state:

    
    
    function Item({ header, content }) {
      const [isOpen, setIsOpen] = useState(false)
      
      return (
        <motion.div
          layout
          onClick={() => setIsOpen(!isOpen)}
        >
          <motion.h2 layout>{header}</motion.h2>
          {isOpen ? content : null}
        </motion.div>
      )
    }

If we arrange these next to each other in an `Accordion`, when their state
updates, their siblings have no way of knowing:

    
    
    function Accordion() {
      return (
        <>
          <ToggleContent />
          <ToggleContent />
        </>  
      )
    }

This can be fixed by grouping both components with `LayoutGroup`:

    
    
    import { LayoutGroup } from "motion/react"
    
    function Accordion() {
      return (
        <LayoutGroup>
          <ToggleContent />
          <ToggleContent />
        </LayoutGroup>  
      )
    }

### Namespace `layoutId`

Components expecting to perform shared layout animations are provided a
`layoutId` prop.

In this following example, each `Tab` renders an element with the
`layoutId="underline"` prop.

    
    
    function Tab({ label, isSelected }) {
      return (
        <li>
          {label}
          {isSelected
            ? <motion.div layoutId="underline" />
            : null}
        </li>  
      )
    }
    
    function TabRow({ items }) {
      return items.map(item => <Tab {...item} />)
    }

`layoutId` is global across your site. So to render multiple `TabRow`s we want
to group them with `LayoutGroup` and `id` prop:

    
    
    function TabRow({ id, items }) {
      return (
        <LayoutGroup id={id}>
          {items.map(item => <Tab {...item} />)}
        </LayoutGroup>
    }

`motion` components with a `layout` prop will detect and animate layout
changes every time they commit a React re-render, or their `layoutDependency`
prop changes.

`LayoutGroup` is used to group components that might not render together but
do affect each-other's state.

## Usage

Take these accordion items that each handle their own state:

    
    
    function Item({ header, content }) {
      const [isOpen, setIsOpen] = useState(false)
      
      return (
        <motion.div
          layout
          onClick={() => setIsOpen(!isOpen)}
        >
          <motion.h2 layout>{header}</motion.h2>
          {isOpen ? content : null}
        </motion.div>
      )
    }

If we arrange these next to each other in an `Accordion`, when their state
updates, their siblings have no way of knowing:

    
    
    function Accordion() {
      return (
        <>
          <ToggleContent />
          <ToggleContent />
        </>  
      )
    }

This can be fixed by grouping both components with `LayoutGroup`:

    
    
    import { LayoutGroup } from "motion/react"
    
    function Accordion() {
      return (
        <LayoutGroup>
          <ToggleContent />
          <ToggleContent />
        </LayoutGroup>  
      )
    }

### Namespace `layoutId`

Components expecting to perform shared layout animations are provided a
`layoutId` prop.

In this following example, each `Tab` renders an element with the
`layoutId="underline"` prop.

    
    
    function Tab({ label, isSelected }) {
      return (
        <li>
          {label}
          {isSelected
            ? <motion.div layoutId="underline" />
            : null}
        </li>  
      )
    }
    
    function TabRow({ items }) {
      return items.map(item => <Tab {...item} />)
    }

`layoutId` is global across your site. So to render multiple `TabRow`s we want
to group them with `LayoutGroup` and `id` prop:

    
    
    function TabRow({ id, items }) {
      return (
        <LayoutGroup id={id}>
          {items.map(item => <Tab {...item} />)}
        </LayoutGroup>
    }

`motion` components with a `layout` prop will detect and animate layout
changes every time they commit a React re-render, or their `layoutDependency`
prop changes.

`LayoutGroup` is used to group components that might not render together but
do affect each-other's state.

## Usage

Take these accordion items that each handle their own state:

    
    
    function Item({ header, content }) {
      const [isOpen, setIsOpen] = useState(false)
      
      return (
        <motion.div
          layout
          onClick={() => setIsOpen(!isOpen)}
        >
          <motion.h2 layout>{header}</motion.h2>
          {isOpen ? content : null}
        </motion.div>
      )
    }

If we arrange these next to each other in an `Accordion`, when their state
updates, their siblings have no way of knowing:

    
    
    function Accordion() {
      return (
        <>
          <ToggleContent />
          <ToggleContent />
        </>  
      )
    }

This can be fixed by grouping both components with `LayoutGroup`:

    
    
    import { LayoutGroup } from "motion/react"
    
    function Accordion() {
      return (
        <LayoutGroup>
          <ToggleContent />
          <ToggleContent />
        </LayoutGroup>  
      )
    }

### Namespace `layoutId`

Components expecting to perform shared layout animations are provided a
`layoutId` prop.

In this following example, each `Tab` renders an element with the
`layoutId="underline"` prop.

    
    
    function Tab({ label, isSelected }) {
      return (
        <li>
          {label}
          {isSelected
            ? <motion.div layoutId="underline" />
            : null}
        </li>  
      )
    }
    
    function TabRow({ items }) {
      return items.map(item => <Tab {...item} />)
    }

`layoutId` is global across your site. So to render multiple `TabRow`s we want
to group them with `LayoutGroup` and `id` prop:

    
    
    function TabRow({ id, items }) {
      return (
        <LayoutGroup id={id}>
          {items.map(item => <Tab {...item} />)}
        </LayoutGroup>
    }

LayoutGroup

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

[Cursor](./cursor)

[LazyMotion](./react-lazy-motion)

