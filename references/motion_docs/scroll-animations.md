# Scroll animations

Source: https://motion.dev/docs/react-scroll-animations

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

Scroll

# Scroll animations

There are two types of scroll animations:

  * **Scroll-triggered:** A normal animation is triggered when an element enters the viewport.

  * **Scroll-linked:** Values are linked directly to scroll progress.

Motion is capable of both types of animation.

## Scroll-triggered animations

Scroll-triggered animations are just normal animations that fire when an
element enters or leaves the viewport.

Motion offers[ the ](./react-motion-
component#whileinview)`[whileInView](./react-motion-component#whileinview)`[
prop](./react-motion-component#whileinview) to set an animation target or
variant when the element enters the view.

    
    
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
    />

### One-time animations

With [the ](./react-motion-component#viewport-1)`[viewport](./react-motion-
component#viewport-1)`[ options](./react-motion-component#viewport-1), it's
possible to set `once: true` so once an element has entered the viewport, it
won't animate back out.

    
    
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    />

### Changing scroll container

By default, the element will be considered within the viewport when it
enters/leaves the **window**. This can be changed by providing the `ref` of
another scrollable element.

    
    
    function Component() {
      const scrollRef = useRef(null)
      
      return (
        <div ref={scrollRef} style={{ overflow: "scroll" }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ root: scrollRef }}
          />
        </div>
      )
    }

For more configuration options, checkout [the ](./react-motion-
component#viewport-1)`[motion](./react-motion-component#viewport-1)`[
component](./react-motion-component#viewport-1) API reference.

### Setting state

It's also possible to set state when any element (not just a `motion`
component) enters and leaves the viewport with the `[useInView](./react-use-
in-view)`[ hook](./react-use-in-view).

## Scroll-linked animations

Scroll-linked animations are created using [motion values](./react-motion-
value) and the `[useScroll](./react-use-scroll)`[ hook](./react-use-scroll).

`useScroll` returns four motion values, two that store scroll offset in pixels
(`scrollX` and `scrollY`) and two that store scroll progress as a value
between `0` and `1`.

These motion values can be passed directly to specific styles. For instance,
passing `scrollYProgress` to `scaleX` works great as a progress bar.

    
    
    const { scrollYProgress } = useScroll();
    
    return (
      <motion.div style={{ scaleX: scrollYProgress }} />  
    )

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
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Value smoothing

This value can be smoothed by passing it through `[useSpring](./react-use-
spring)`.

    
    
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
      stiffness: 100,
      damping: 30,
      restDelta: 0.001
    })
    
    return <motion.div style={{ scaleX }} />

### Transform other values

With [the ](./react-use-transform)`[useTransform](./react-use-transform)`[
hook](./react-use-transform), it's easy to use the progress motion values to
mix between any value, like colors:

    
    
    const backgroundColor = useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      ["#f00", "#0f0", "#00f"]
    )
    
    return <motion.div style={{ backgroundColor }} />

### Examples

#### Track element scroll offset

#### Track element within viewport

#### Parallax

#### 3D

#### Scroll velocity and direction

Read the [full ](./react-use-scroll)`[useScroll](./react-use-scroll)`[
docs](./react-use-scroll) to discover more about creating the above effects.

There are two types of scroll animations:

  * **Scroll-triggered:** A normal animation is triggered when an element enters the viewport.

  * **Scroll-linked:** Values are linked directly to scroll progress.

Motion is capable of both types of animation.

## Scroll-triggered animations

Scroll-triggered animations are just normal animations that fire when an
element enters or leaves the viewport.

Motion offers[ the ](./react-motion-
component#whileinview)`[whileInView](./react-motion-component#whileinview)`[
prop](./react-motion-component#whileinview) to set an animation target or
variant when the element enters the view.

    
    
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
    />

### One-time animations

With [the ](./react-motion-component#viewport-1)`[viewport](./react-motion-
component#viewport-1)`[ options](./react-motion-component#viewport-1), it's
possible to set `once: true` so once an element has entered the viewport, it
won't animate back out.

    
    
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    />

### Changing scroll container

By default, the element will be considered within the viewport when it
enters/leaves the **window**. This can be changed by providing the `ref` of
another scrollable element.

    
    
    function Component() {
      const scrollRef = useRef(null)
      
      return (
        <div ref={scrollRef} style={{ overflow: "scroll" }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ root: scrollRef }}
          />
        </div>
      )
    }

For more configuration options, checkout [the ](./react-motion-
component#viewport-1)`[motion](./react-motion-component#viewport-1)`[
component](./react-motion-component#viewport-1) API reference.

### Setting state

It's also possible to set state when any element (not just a `motion`
component) enters and leaves the viewport with the `[useInView](./react-use-
in-view)`[ hook](./react-use-in-view).

## Scroll-linked animations

Scroll-linked animations are created using [motion values](./react-motion-
value) and the `[useScroll](./react-use-scroll)`[ hook](./react-use-scroll).

`useScroll` returns four motion values, two that store scroll offset in pixels
(`scrollX` and `scrollY`) and two that store scroll progress as a value
between `0` and `1`.

These motion values can be passed directly to specific styles. For instance,
passing `scrollYProgress` to `scaleX` works great as a progress bar.

    
    
    const { scrollYProgress } = useScroll();
    
    return (
      <motion.div style={{ scaleX: scrollYProgress }} />  
    )

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
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Value smoothing

This value can be smoothed by passing it through `[useSpring](./react-use-
spring)`.

    
    
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
      stiffness: 100,
      damping: 30,
      restDelta: 0.001
    })
    
    return <motion.div style={{ scaleX }} />

### Transform other values

With [the ](./react-use-transform)`[useTransform](./react-use-transform)`[
hook](./react-use-transform), it's easy to use the progress motion values to
mix between any value, like colors:

    
    
    const backgroundColor = useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      ["#f00", "#0f0", "#00f"]
    )
    
    return <motion.div style={{ backgroundColor }} />

### Examples

#### Track element scroll offset

#### Track element within viewport

#### Parallax

#### 3D

#### Scroll velocity and direction

Read the [full ](./react-use-scroll)`[useScroll](./react-use-scroll)`[
docs](./react-use-scroll) to discover more about creating the above effects.

There are two types of scroll animations:

  * **Scroll-triggered:** A normal animation is triggered when an element enters the viewport.

  * **Scroll-linked:** Values are linked directly to scroll progress.

Motion is capable of both types of animation.

## Scroll-triggered animations

Scroll-triggered animations are just normal animations that fire when an
element enters or leaves the viewport.

Motion offers[ the ](./react-motion-
component#whileinview)`[whileInView](./react-motion-component#whileinview)`[
prop](./react-motion-component#whileinview) to set an animation target or
variant when the element enters the view.

    
    
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
    />

### One-time animations

With [the ](./react-motion-component#viewport-1)`[viewport](./react-motion-
component#viewport-1)`[ options](./react-motion-component#viewport-1), it's
possible to set `once: true` so once an element has entered the viewport, it
won't animate back out.

    
    
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    />

### Changing scroll container

By default, the element will be considered within the viewport when it
enters/leaves the **window**. This can be changed by providing the `ref` of
another scrollable element.

    
    
    function Component() {
      const scrollRef = useRef(null)
      
      return (
        <div ref={scrollRef} style={{ overflow: "scroll" }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ root: scrollRef }}
          />
        </div>
      )
    }

For more configuration options, checkout [the ](./react-motion-
component#viewport-1)`[motion](./react-motion-component#viewport-1)`[
component](./react-motion-component#viewport-1) API reference.

### Setting state

It's also possible to set state when any element (not just a `motion`
component) enters and leaves the viewport with the `[useInView](./react-use-
in-view)`[ hook](./react-use-in-view).

## Scroll-linked animations

Scroll-linked animations are created using [motion values](./react-motion-
value) and the `[useScroll](./react-use-scroll)`[ hook](./react-use-scroll).

`useScroll` returns four motion values, two that store scroll offset in pixels
(`scrollX` and `scrollY`) and two that store scroll progress as a value
between `0` and `1`.

These motion values can be passed directly to specific styles. For instance,
passing `scrollYProgress` to `scaleX` works great as a progress bar.

    
    
    const { scrollYProgress } = useScroll();
    
    return (
      <motion.div style={{ scaleX: scrollYProgress }} />  
    )

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
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Value smoothing

This value can be smoothed by passing it through `[useSpring](./react-use-
spring)`.

    
    
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
      stiffness: 100,
      damping: 30,
      restDelta: 0.001
    })
    
    return <motion.div style={{ scaleX }} />

### Transform other values

With [the ](./react-use-transform)`[useTransform](./react-use-transform)`[
hook](./react-use-transform), it's easy to use the progress motion values to
mix between any value, like colors:

    
    
    const backgroundColor = useTransform(
      scrollYProgress,
      [0, 0.5, 1],
      ["#f00", "#0f0", "#00f"]
    )
    
    return <motion.div style={{ backgroundColor }} />

### Examples

#### Track element scroll offset

#### Track element within viewport

#### Parallax

#### 3D

#### Scroll velocity and direction

Read the [full ](./react-use-scroll)`[useScroll](./react-use-scroll)`[
docs](./react-use-scroll) to discover more about creating the above effects.

[Layout animations](./react-layout-animations)

[Transitions](./react-transitions)

