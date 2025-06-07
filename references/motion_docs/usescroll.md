# useScroll

Source: https://motion.dev/docs/react-use-scroll

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

useScroll

# useScroll

`useScroll` is used to create scroll-linked animations, like progress
indicators and parallax effects.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

##  Usage

Import `useScroll` from Motion:

    
    
    import { useScroll } from "motion/react"

`useScroll` returns four [motion values](./react-motion-value):

  * `scrollX`/`Y`: The absolute scroll position, in pixels.

  * `scrollXProgress`/`YProgress`: The scroll position between the defined offsets, as a value between `0` and `1`.

### Page scroll

By default, useScroll tracks the page scroll.

    
    
    const { scrollY } = useScroll()
    
    useMotionValueEvent(scrollY, "change", (latest) => {
      console.log("Page scroll: ", latest)
    })

For example, we could show a page scroll indicator by passing
`scrollYProgress` straight to the `scaleX` style of a progress bar.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

As `useScroll` returns motion values, we can compose this scroll info with
other motion value hooks like `useTransform` and `useSpring`:

    
    
    const { scrollYProgress } = useScroll()
    const scaleX = useSpring(scrollYProgress)
    
    return <motion.div style={{ scaleX }} />

> Since `scrollY` is a `MotionValue`, there's a neat trick you can use to tell
> when the user's scroll direction changes:
>  
>  
>     const { scrollY } = useScroll()
>     const [scrollDirection, setScrollDirection] = useState("down")
>  
>     useMotionValueEvent(scrollY, "change", (current) => {
>       const diff = current - scrollY.getPrevious()
>       setScrollDirection(diff > 0 ? "down" : "up")
>     })
>
> Perfect for triggering a sticky header animation!
>
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Element scroll

To track the scroll position of a scrollable element we can pass the element's
`ref` to `useScroll`'s `container` option:

    
    
    const carouselRef = useRef(null)
    const { scrollX } = useScroll({
      container: carouselRef
    })
    
    return (
      <div ref={carouselRef} style={{ overflow: "scroll" }}>
        {children}
      </div>
    )

### Element position

We can track the progress of an element as it moves within a container by
passing its `ref` to the `target` option.

    
    
    const ref = useRef(null)
    const { scrollYProgress } = useScroll({
      target: ref,
      offset: ["start end", "end end"]
    })
    
    return <div ref={ref}>

In this example, each item has its own progress indicator.

### Scroll offsets

With [the ](./react-use-scroll#offset)`[offset](./react-use-scroll#offset)`[
option](./react-use-scroll#offset) we can define which parts of the element we
want to track with the viewport, for instance track elements as they enter in
from the bottom, leave at the top, or travel throughout the whole viewport.

## API

`useScroll` accepts the following options.

### `container`

**Default** : Browser window

The scrollable container to track the scroll position of. By default, this is
the window viewport. But it can be any scrollable element.

### `target`

By default, this is the scrollable area of the container. It can additionally
be set as another element, to track its progress within the viewport.

### `axis`

**Default:**`"y"`

The scroll axis to apply `offset`.

### `offset`

**Default:** `["start start", "end end"]`

`offset` describes intersections, points where the `target` and `container`
meet.

For example, the intersection `"start end"` means when the **start of the
target** on the tracked axis meets the **end of the container.**

So if the target is an element, the container is the window, and we're
tracking the vertical axis then `"start end"` is where the **top of the
element** meets **the bottom of the viewport**.

#### Accepted intersections

Both target and container points can be defined as:

  * **Number:** A value where `0` represents the start of the axis and `1` represents the end. So to define the top of the target with the middle of the container you could define `"0 0.5"`. Values outside this range are permitted.

  * **Names:** `"start"`, `"center"` and `"end"` can be used as clear shortcuts for `0`, `0.5` and `1` respectively.

  * **Pixels:** Pixel values like `"100px"`, `"-50px"` will be defined as that number of pixels from the start of the target/container.

  * **Percent:** Same as raw numbers but expressed as `"0%"` to `"100%"`.

  * **Viewport:** `"vh"` and `"vw"` units are accepted.

## Examples

### React Three Fiber

### Scroll velocity

`useScroll` is used to create scroll-linked animations, like progress
indicators and parallax effects.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

##  Usage

Import `useScroll` from Motion:

    
    
    import { useScroll } from "motion/react"

`useScroll` returns four [motion values](./react-motion-value):

  * `scrollX`/`Y`: The absolute scroll position, in pixels.

  * `scrollXProgress`/`YProgress`: The scroll position between the defined offsets, as a value between `0` and `1`.

### Page scroll

By default, useScroll tracks the page scroll.

    
    
    const { scrollY } = useScroll()
    
    useMotionValueEvent(scrollY, "change", (latest) => {
      console.log("Page scroll: ", latest)
    })

For example, we could show a page scroll indicator by passing
`scrollYProgress` straight to the `scaleX` style of a progress bar.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

As `useScroll` returns motion values, we can compose this scroll info with
other motion value hooks like `useTransform` and `useSpring`:

    
    
    const { scrollYProgress } = useScroll()
    const scaleX = useSpring(scrollYProgress)
    
    return <motion.div style={{ scaleX }} />

> Since `scrollY` is a `MotionValue`, there's a neat trick you can use to tell
> when the user's scroll direction changes:
>  
>  
>     const { scrollY } = useScroll()
>     const [scrollDirection, setScrollDirection] = useState("down")
>  
>     useMotionValueEvent(scrollY, "change", (current) => {
>       const diff = current - scrollY.getPrevious()
>       setScrollDirection(diff > 0 ? "down" : "up")
>     })
>
> Perfect for triggering a sticky header animation!
>
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Element scroll

To track the scroll position of a scrollable element we can pass the element's
`ref` to `useScroll`'s `container` option:

    
    
    const carouselRef = useRef(null)
    const { scrollX } = useScroll({
      container: carouselRef
    })
    
    return (
      <div ref={carouselRef} style={{ overflow: "scroll" }}>
        {children}
      </div>
    )

### Element position

We can track the progress of an element as it moves within a container by
passing its `ref` to the `target` option.

    
    
    const ref = useRef(null)
    const { scrollYProgress } = useScroll({
      target: ref,
      offset: ["start end", "end end"]
    })
    
    return <div ref={ref}>

In this example, each item has its own progress indicator.

### Scroll offsets

With [the ](./react-use-scroll#offset)`[offset](./react-use-scroll#offset)`[
option](./react-use-scroll#offset) we can define which parts of the element we
want to track with the viewport, for instance track elements as they enter in
from the bottom, leave at the top, or travel throughout the whole viewport.

## API

`useScroll` accepts the following options.

### `container`

**Default** : Browser window

The scrollable container to track the scroll position of. By default, this is
the window viewport. But it can be any scrollable element.

### `target`

By default, this is the scrollable area of the container. It can additionally
be set as another element, to track its progress within the viewport.

### `axis`

**Default:**`"y"`

The scroll axis to apply `offset`.

### `offset`

**Default:** `["start start", "end end"]`

`offset` describes intersections, points where the `target` and `container`
meet.

For example, the intersection `"start end"` means when the **start of the
target** on the tracked axis meets the **end of the container.**

So if the target is an element, the container is the window, and we're
tracking the vertical axis then `"start end"` is where the **top of the
element** meets **the bottom of the viewport**.

#### Accepted intersections

Both target and container points can be defined as:

  * **Number:** A value where `0` represents the start of the axis and `1` represents the end. So to define the top of the target with the middle of the container you could define `"0 0.5"`. Values outside this range are permitted.

  * **Names:** `"start"`, `"center"` and `"end"` can be used as clear shortcuts for `0`, `0.5` and `1` respectively.

  * **Pixels:** Pixel values like `"100px"`, `"-50px"` will be defined as that number of pixels from the start of the target/container.

  * **Percent:** Same as raw numbers but expressed as `"0%"` to `"100%"`.

  * **Viewport:** `"vh"` and `"vw"` units are accepted.

## Examples

### React Three Fiber

### Scroll velocity

`useScroll` is used to create scroll-linked animations, like progress
indicators and parallax effects.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

##  Usage

Import `useScroll` from Motion:

    
    
    import { useScroll } from "motion/react"

`useScroll` returns four [motion values](./react-motion-value):

  * `scrollX`/`Y`: The absolute scroll position, in pixels.

  * `scrollXProgress`/`YProgress`: The scroll position between the defined offsets, as a value between `0` and `1`.

### Page scroll

By default, useScroll tracks the page scroll.

    
    
    const { scrollY } = useScroll()
    
    useMotionValueEvent(scrollY, "change", (latest) => {
      console.log("Page scroll: ", latest)
    })

For example, we could show a page scroll indicator by passing
`scrollYProgress` straight to the `scaleX` style of a progress bar.

    
    
    const { scrollYProgress } = useScroll()
    
    return <motion.div style={{ scaleX: scrollYProgress }} />

As `useScroll` returns motion values, we can compose this scroll info with
other motion value hooks like `useTransform` and `useSpring`:

    
    
    const { scrollYProgress } = useScroll()
    const scaleX = useSpring(scrollYProgress)
    
    return <motion.div style={{ scaleX }} />

> Since `scrollY` is a `MotionValue`, there's a neat trick you can use to tell
> when the user's scroll direction changes:
>  
>  
>     const { scrollY } = useScroll()
>     const [scrollDirection, setScrollDirection] = useState("down")
>  
>     useMotionValueEvent(scrollY, "change", (current) => {
>       const diff = current - scrollY.getPrevious()
>       setScrollDirection(diff > 0 ? "down" : "up")
>     })
>
> Perfect for triggering a sticky header animation!
>
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Element scroll

To track the scroll position of a scrollable element we can pass the element's
`ref` to `useScroll`'s `container` option:

    
    
    const carouselRef = useRef(null)
    const { scrollX } = useScroll({
      container: carouselRef
    })
    
    return (
      <div ref={carouselRef} style={{ overflow: "scroll" }}>
        {children}
      </div>
    )

### Element position

We can track the progress of an element as it moves within a container by
passing its `ref` to the `target` option.

    
    
    const ref = useRef(null)
    const { scrollYProgress } = useScroll({
      target: ref,
      offset: ["start end", "end end"]
    })
    
    return <div ref={ref}>

In this example, each item has its own progress indicator.

### Scroll offsets

With [the ](./react-use-scroll#offset)`[offset](./react-use-scroll#offset)`[
option](./react-use-scroll#offset) we can define which parts of the element we
want to track with the viewport, for instance track elements as they enter in
from the bottom, leave at the top, or travel throughout the whole viewport.

## API

`useScroll` accepts the following options.

### `container`

**Default** : Browser window

The scrollable container to track the scroll position of. By default, this is
the window viewport. But it can be any scrollable element.

### `target`

By default, this is the scrollable area of the container. It can additionally
be set as another element, to track its progress within the viewport.

### `axis`

**Default:**`"y"`

The scroll axis to apply `offset`.

### `offset`

**Default:** `["start start", "end end"]`

`offset` describes intersections, points where the `target` and `container`
meet.

For example, the intersection `"start end"` means when the **start of the
target** on the tracked axis meets the **end of the container.**

So if the target is an element, the container is the window, and we're
tracking the vertical axis then `"start end"` is where the **top of the
element** meets **the bottom of the viewport**.

#### Accepted intersections

Both target and container points can be defined as:

  * **Number:** A value where `0` represents the start of the axis and `1` represents the end. So to define the top of the target with the middle of the container you could define `"0 0.5"`. Values outside this range are permitted.

  * **Names:** `"start"`, `"center"` and `"end"` can be used as clear shortcuts for `0`, `0.5` and `1` respectively.

  * **Pixels:** Pixel values like `"100px"`, `"-50px"` will be defined as that number of pixels from the start of the target/container.

  * **Percent:** Same as raw numbers but expressed as `"0%"` to `"100%"`.

  * **Viewport:** `"vh"` and `"vw"` units are accepted.

## Examples

### React Three Fiber

### Scroll velocity

[useMotionValueEvent](./react-use-motion-value-event)

[useSpring](./react-use-spring)

