# React animation

Source: https://motion.dev/docs/react-animation

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

Overview

# React animation

Motion for React offers a number of ways to animate your UI. Scaling from
extremely simple prop-based animations, to more complex orchestration.

## Basic animations

You'll perform almost all animations on [a ](./react-motion-
component)`[<motion />](./react-motion-component)`[ component](./react-motion-
component). This is basically a DOM element with motion superpowers.

    
    
    import { motion } from "motion/react"

For basic animations, you can update values on [the ](./react-motion-
component#animate)`[animate](./react-motion-component#animate)`[
prop](./react-motion-component#animate):

    
    
    <motion.div animate={{ opacity: 1 }} />

When any value in its animate prop changes, the component will automatically
animate to the new target.

## Animatable values

Motion can animate any CSS value, even those that can't be animated by
browsers, like `mask-image`. It supports:

  * Numbers: `0`, `100` etc.

  * Strings containing numbers: `"0vh"`, `"10px"` etc.

  * Colors: Hex, RGBA, HSLA.

  * Complex strings containing multiple numbers and/or colors (like `box-shadow`).

  * `display: "none"/"block"` and `visibility: "hidden"/"visible"`.

### Value type conversion

In general, values can only be animated between two of the same type (i.e
`"0px"` to `"100px"`).

Colors can be freely animated between hex, RGBA and HSLA types.

Additionally, `x`, `y`, `width`, `height`, `top`, `left`, `right` and `bottom`
can animate between different value types.

    
    
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: "calc(100vw - 50%)" }}
    />

It's also possible to animate `width` and `height` in to/out of `"auto"`.

    
    
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
    />

**Note:** If additionally animating `display` in to/out of `"none"`, replace
this with `visibility` `"hidden"` as elements with `display: none` can't be
measured.

### Transforms

Unlike CSS, Motion can animate every transform axis independently:

  * Translate: `x`, `y`, `z`

  * Scale: `scale`, `scaleX`, `scaleY`

  * Rotate: `rotate`, `rotateX`, `rotateY`, `rotateZ`

  * Skew: `skew`, `skewX`, `skewY`

  * Perspective: `transformPerspective`

`motion` components have enhanced `style` props, allowing you to set
individual transforms:

    
    
    <motion.section style={{ x: -20 }} />

Animating transforms independently provides great flexibility, especially
around gestures.

    
    
    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} />

Independent transforms perform great, but Motion's hybrid engine also uniquely
offers hardware acceleration by setting `transform` directly.

    
    
    <motion.li
      initial={{ transform: "translateX(-100px)" }}
      animate={{ transform: "translateX(0px)" }}
      transition={{ type: "spring" }}
    />

**SVG note:** For SVG components, `x` and `y` **attributes** can be set using
`attrX` and `attrY`.

### Transform origin

`transform-origin` has three shortcut values that can be set and animated
individually:

  * `originX`

  * `originY`

  * `originZ`

If set as numbers, `originX` and `Y` default to a progress value between `0`
and `1`. `originZ` defaults to pixels.

    
    
    <motion.div style={{ originX: 0.5 }} />

### CSS variables

Motion for React can animate the value of CSS variables, and also use CSS
variables as animation targets.

#### Animating CSS variables

Sometimes it's convenient to be able to animate a CSS variable to animate many
children:

    
    
    <motion.ul
      initial={{ '--rotate': '0deg' }}
      animate={{ '--rotate': '360deg' }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <li style={{ transform: 'rotate(var(--rotate))' }} />
      <li style={{ transform: 'rotate(var(--rotate))' }} />
      <li style={{ transform: 'rotate(var(--rotate))' }} />
    </motion.ul>

**Note:** Animating the value of a CSS variable **always triggers paint** ,
therefore it can be more performant to use `[MotionValue](./react-motion-
value)`[s](./react-motion-value) to setup this kind of animation.

### CSS variables as animation targets

HTML `motion` components accept animation targets with CSS variables:

    
    
    <motion.li animate={{ backgroundColor: "var(--action-bg)" }} />

#### SVG line drawing

Line drawing animations can be created with many different SVG elements using
three special properties: `pathLength`, `pathSpacing` and `pathOffset`.

    
    
    <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />

All three are set as a progress value between `0` and `1`, `1` representing
the total length of the path.

Path animations are compatible with `circle`, `ellipse`, `line`, `path`,
`polygon`, `polyline` and `rect` elements.

## Transitions

By default, Motion will create appropriate transitions for snappy animations
based on the type of value being animated.

For instance, physical properties like `x` or `scale` are animated with spring
physics, whereas values like `opacity` or `color` are animated with duration-
based easing curves.

However, you can define your own animations via [the ](./react-
transitions)`[transition](./react-transitions)`[ prop](./react-transitions).

    
    
    <motion.div
      animate={{ x: 100 }}
      transition={{ ease: "easeOut", duration: 2 }}
    />

## Enter animations

When a `motion` component is first created, it'll automatically animate to the
values in `animate` if they're different from those initially rendered, which
you can either do via CSS or via [the ](./react-motion-
value)`[initial](./react-motion-value)`[ prop.](./react-motion-value)

    
    
    <motion.li
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
    />

You can also disable the enter animation entirely by setting
`initial={false}`. This will make the element render with the values defined
in `animate`.

    
    
    <motion.div initial={false} animate={{ y: 100 }} />

## Exit animations

You can also easily animate elements as they exit the DOM.

In React, when a component is removed, it's usually removed instantly. Motion
provides [the ](./react-animate-presence)`[AnimatePresence](./react-animate-
presence)`[ component](./react-animate-presence) which keeps elements in the
DOM while they perform an `exit` animation.

    
    
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </AnimatePresence>

## Keyframes

Values in `animate` can be set as a series of keyframes. This will animate
through each value in sequence.

    
    
    <motion.div animate={{ x: [0, 100, 0] }} />

We can use a value's current state as the initial keyframe by setting it to
`null`.

    
    
    <motion.div animate={{ x: [null, 100, 0] }} />

This way, if a keyframe animation is interrupting another animation, the
transition will feel more natural.

By default, each keyframe is spaced naturally throughout the animation. You
can override this by setting [the ](./react-
transitions#times)`[times](./react-transitions#times)`[ option](./react-
transitions#times) via `transition`.

`times` is an array of progress values between `0` and `1`, defining where in
the animation each keyframe should be positioned.

    
    
    <motion.circle
      cx={500}
      animate={{
        cx: [null, 100, 200],
        transition: { duration: 3, times: [0, 0.2, 1] }
      }}
    />

## Gesture animations

Motion for React has shortcut props for animating to/from a target when a
gesture starts/ends.

    
    
    <motion.button
      initial={{ opacity: 0 }}
      whileHover={{ backgroundColor: "rgba(220, 220, 220, 1)" }}
      whileTap={{ backgroundColor: "rgba(255, 255, 255, 1)" }}
      whileInView={{ opacity: 1 }}
    />

It supports `hover`, `tap`, `drag`, `focus` and `inView`.

## Variants

Setting `animate` as a target is useful for simple, single-element animations.
But sometimes we want to orchestrate animations that propagate throughout the
DOM. We can do so with variants.

Variants are a set of named targets.

    
    
    const variants = {
      visible: { opacity: 1 },
      hidden: { opacity: 0 },
    }

They're passed to `motion` components via the `variants` prop:

    
    
    <motion.div variants={variants} />

These variants can now be referred to by a label, wherever you can define an
animation target:

    
    
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
    />

You can also define multiple variants via an array:

    
    
    animate={["visible", "danger"]}

> _I love using variants alongside React state – just pass your state to_`
> _animate_` _, and now you've got a tidy place to define all your animation
> targets!_
>  
>  
>      const [status, setStatus] = useState<"inactive" | "active" | "complete">(
>       "inactive"
>     );
>  
>     <motion.div
>       animate={status} // pass in our React state!
>       variants={{
>         inactive: { scale: 0.9 color: "var(--gray-500)" },
>         active: { scale: 1 color: "var(--blue-500)" },
>         complete: { scale: 1 color: "var(--blue-500)" }
>       }}
>     >
>       <motion.svg
>         path={checkmarkPath}
>         variants={{
>           inactive: { pathLength: 0 },
>           active: { pathLength: 0 },
>           complete: { pathLength: 1}
>         }}
>       />
>     </motion.div>
>
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Propagation

This is already useful for reusing and combining animation targets. But it
becomes powerful for orchestrating animations throughout trees.

Variants will flow down through `motion` components. So in this example when
the `ul` enters the viewport, all of its children with a "visible" variant
will also animate in:

    
    
    const list = {
      visible: { opacity: 1 },
      hidden: { opacity: 0 },
    }
    
    const item = {
      visible: { opacity: 1, x: 0 },
      hidden: { opacity: 0, x: -100 },
    }
    
    return (
      <motion.ul
        initial="hidden"
        whileInView="visible"
        variants={list}
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

### Orchestration

By default, this children animations will start simultaneously with the
parent. But with variants we gain access to new `transition` props like
`[when](./react-transitions#orchestration)`[, ](./react-
transitions#orchestration)`[delayChildren](./react-
transitions#orchestration)`[, ](./react-
transitions#orchestration)`[staggerChildren](./react-
transitions#orchestration)`[ and ](./react-
transitions#orchestration)`[staggerDirection](./react-
transitions#orchestration)`.

    
    
    const list = {
      visible: {
        opacity: 1,
        transition: {
          when: "beforeChildren",
          staggerChildren: 0.3, // Stagger children by .3 seconds
        },
      },
      hidden: {
        opacity: 0,
        transition: {
          when: "afterChildren",
        },
      },
    }

### Dynamic variants

Each variant can be defined as a function that resolves when a variant is made
active.

    
    
    const variants = {
      hidden: { opacity: 0 },
      visible: (index) => ({
        opacity: 1,
        transition: { delay: index * 0.3 }
      })
    }

These functions are provided a single argument, which is passed via the
`custom` prop:

    
    
    items.map((item, index) => <motion.div custom={index} variants={variants} />)

This way, variants can be resolved differently for each animating element.

## Animation controls

Declarative animations are ideal for most UI interactions. But sometimes we
need to take manual control over animation playback.

The `[useAnimate](./react-use-animate)`[ hook](./react-use-animate) can be
used for:

  * Animating any HTML/SVG element (not just `motion` components).

  * Complex animation sequences.

  * Controlling animations with `time`, `speed`, `play()`, `pause()` and other playback controls.

    
    
    function MyComponent() {
      const [scope, animate] = useAnimate()
    
      useEffect(() => {
        const controls = animate([
          [scope.current, { x: "100%" }],
          ["li", { opacity: 1 }]
        ])
    
        controls.speed = 0.8
    
        return () => controls.stop()
      }, [])
    
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

## Animate content

By passing [a ](./react-motion-value)`[MotionValue](./react-motion-value)` as
the child of a `motion` component, it will render its latest value in the
HTML.

    
    
    import { useMotionValue, motion, animate } from "motion/react"
    
    function Counter() {
      const count = useMotionValue(0)
    
      useEffect(() => {
        const controls = animate(count, 100, { duration: 5 })
        return () => controls.stop()
      }, [])
    
      return <motion.pre>{count}</motion.pre>
    }

This is more performant than setting React state as the `motion` component
will set `innerHTML` directly.

Motion for React offers a number of ways to animate your UI. Scaling from
extremely simple prop-based animations, to more complex orchestration.

## Basic animations

You'll perform almost all animations on [a ](./react-motion-
component)`[<motion />](./react-motion-component)`[ component](./react-motion-
component). This is basically a DOM element with motion superpowers.

    
    
    import { motion } from "motion/react"

For basic animations, you can update values on [the ](./react-motion-
component#animate)`[animate](./react-motion-component#animate)`[
prop](./react-motion-component#animate):

    
    
    <motion.div animate={{ opacity: 1 }} />

When any value in its animate prop changes, the component will automatically
animate to the new target.

## Animatable values

Motion can animate any CSS value, even those that can't be animated by
browsers, like `mask-image`. It supports:

  * Numbers: `0`, `100` etc.

  * Strings containing numbers: `"0vh"`, `"10px"` etc.

  * Colors: Hex, RGBA, HSLA.

  * Complex strings containing multiple numbers and/or colors (like `box-shadow`).

  * `display: "none"/"block"` and `visibility: "hidden"/"visible"`.

### Value type conversion

In general, values can only be animated between two of the same type (i.e
`"0px"` to `"100px"`).

Colors can be freely animated between hex, RGBA and HSLA types.

Additionally, `x`, `y`, `width`, `height`, `top`, `left`, `right` and `bottom`
can animate between different value types.

    
    
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: "calc(100vw - 50%)" }}
    />

It's also possible to animate `width` and `height` in to/out of `"auto"`.

    
    
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
    />

**Note:** If additionally animating `display` in to/out of `"none"`, replace
this with `visibility` `"hidden"` as elements with `display: none` can't be
measured.

### Transforms

Unlike CSS, Motion can animate every transform axis independently:

  * Translate: `x`, `y`, `z`

  * Scale: `scale`, `scaleX`, `scaleY`

  * Rotate: `rotate`, `rotateX`, `rotateY`, `rotateZ`

  * Skew: `skew`, `skewX`, `skewY`

  * Perspective: `transformPerspective`

`motion` components have enhanced `style` props, allowing you to set
individual transforms:

    
    
    <motion.section style={{ x: -20 }} />

Animating transforms independently provides great flexibility, especially
around gestures.

    
    
    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} />

Independent transforms perform great, but Motion's hybrid engine also uniquely
offers hardware acceleration by setting `transform` directly.

    
    
    <motion.li
      initial={{ transform: "translateX(-100px)" }}
      animate={{ transform: "translateX(0px)" }}
      transition={{ type: "spring" }}
    />

**SVG note:** For SVG components, `x` and `y` **attributes** can be set using
`attrX` and `attrY`.

### Transform origin

`transform-origin` has three shortcut values that can be set and animated
individually:

  * `originX`

  * `originY`

  * `originZ`

If set as numbers, `originX` and `Y` default to a progress value between `0`
and `1`. `originZ` defaults to pixels.

    
    
    <motion.div style={{ originX: 0.5 }} />

### CSS variables

Motion for React can animate the value of CSS variables, and also use CSS
variables as animation targets.

#### Animating CSS variables

Sometimes it's convenient to be able to animate a CSS variable to animate many
children:

    
    
    <motion.ul
      initial={{ '--rotate': '0deg' }}
      animate={{ '--rotate': '360deg' }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <li style={{ transform: 'rotate(var(--rotate))' }} />
      <li style={{ transform: 'rotate(var(--rotate))' }} />
      <li style={{ transform: 'rotate(var(--rotate))' }} />
    </motion.ul>

**Note:** Animating the value of a CSS variable **always triggers paint** ,
therefore it can be more performant to use `[MotionValue](./react-motion-
value)`[s](./react-motion-value) to setup this kind of animation.

### CSS variables as animation targets

HTML `motion` components accept animation targets with CSS variables:

    
    
    <motion.li animate={{ backgroundColor: "var(--action-bg)" }} />

#### SVG line drawing

Line drawing animations can be created with many different SVG elements using
three special properties: `pathLength`, `pathSpacing` and `pathOffset`.

    
    
    <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />

All three are set as a progress value between `0` and `1`, `1` representing
the total length of the path.

Path animations are compatible with `circle`, `ellipse`, `line`, `path`,
`polygon`, `polyline` and `rect` elements.

## Transitions

By default, Motion will create appropriate transitions for snappy animations
based on the type of value being animated.

For instance, physical properties like `x` or `scale` are animated with spring
physics, whereas values like `opacity` or `color` are animated with duration-
based easing curves.

However, you can define your own animations via [the ](./react-
transitions)`[transition](./react-transitions)`[ prop](./react-transitions).

    
    
    <motion.div
      animate={{ x: 100 }}
      transition={{ ease: "easeOut", duration: 2 }}
    />

## Enter animations

When a `motion` component is first created, it'll automatically animate to the
values in `animate` if they're different from those initially rendered, which
you can either do via CSS or via [the ](./react-motion-
value)`[initial](./react-motion-value)`[ prop.](./react-motion-value)

    
    
    <motion.li
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
    />

You can also disable the enter animation entirely by setting
`initial={false}`. This will make the element render with the values defined
in `animate`.

    
    
    <motion.div initial={false} animate={{ y: 100 }} />

## Exit animations

You can also easily animate elements as they exit the DOM.

In React, when a component is removed, it's usually removed instantly. Motion
provides [the ](./react-animate-presence)`[AnimatePresence](./react-animate-
presence)`[ component](./react-animate-presence) which keeps elements in the
DOM while they perform an `exit` animation.

    
    
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </AnimatePresence>

## Keyframes

Values in `animate` can be set as a series of keyframes. This will animate
through each value in sequence.

    
    
    <motion.div animate={{ x: [0, 100, 0] }} />

We can use a value's current state as the initial keyframe by setting it to
`null`.

    
    
    <motion.div animate={{ x: [null, 100, 0] }} />

This way, if a keyframe animation is interrupting another animation, the
transition will feel more natural.

By default, each keyframe is spaced naturally throughout the animation. You
can override this by setting [the ](./react-
transitions#times)`[times](./react-transitions#times)`[ option](./react-
transitions#times) via `transition`.

`times` is an array of progress values between `0` and `1`, defining where in
the animation each keyframe should be positioned.

    
    
    <motion.circle
      cx={500}
      animate={{
        cx: [null, 100, 200],
        transition: { duration: 3, times: [0, 0.2, 1] }
      }}
    />

## Gesture animations

Motion for React has shortcut props for animating to/from a target when a
gesture starts/ends.

    
    
    <motion.button
      initial={{ opacity: 0 }}
      whileHover={{ backgroundColor: "rgba(220, 220, 220, 1)" }}
      whileTap={{ backgroundColor: "rgba(255, 255, 255, 1)" }}
      whileInView={{ opacity: 1 }}
    />

It supports `hover`, `tap`, `drag`, `focus` and `inView`.

## Variants

Setting `animate` as a target is useful for simple, single-element animations.
But sometimes we want to orchestrate animations that propagate throughout the
DOM. We can do so with variants.

Variants are a set of named targets.

    
    
    const variants = {
      visible: { opacity: 1 },
      hidden: { opacity: 0 },
    }

They're passed to `motion` components via the `variants` prop:

    
    
    <motion.div variants={variants} />

These variants can now be referred to by a label, wherever you can define an
animation target:

    
    
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
    />

You can also define multiple variants via an array:

    
    
    animate={["visible", "danger"]}

> _I love using variants alongside React state – just pass your state to_`
> _animate_` _, and now you've got a tidy place to define all your animation
> targets!_
>  
>  
>      const [status, setStatus] = useState<"inactive" | "active" | "complete">(
>       "inactive"
>     );
>  
>     <motion.div
>       animate={status} // pass in our React state!
>       variants={{
>         inactive: { scale: 0.9 color: "var(--gray-500)" },
>         active: { scale: 1 color: "var(--blue-500)" },
>         complete: { scale: 1 color: "var(--blue-500)" }
>       }}
>     >
>       <motion.svg
>         path={checkmarkPath}
>         variants={{
>           inactive: { pathLength: 0 },
>           active: { pathLength: 0 },
>           complete: { pathLength: 1}
>         }}
>       />
>     </motion.div>
>
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Propagation

This is already useful for reusing and combining animation targets. But it
becomes powerful for orchestrating animations throughout trees.

Variants will flow down through `motion` components. So in this example when
the `ul` enters the viewport, all of its children with a "visible" variant
will also animate in:

    
    
    const list = {
      visible: { opacity: 1 },
      hidden: { opacity: 0 },
    }
    
    const item = {
      visible: { opacity: 1, x: 0 },
      hidden: { opacity: 0, x: -100 },
    }
    
    return (
      <motion.ul
        initial="hidden"
        whileInView="visible"
        variants={list}
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

### Orchestration

By default, this children animations will start simultaneously with the
parent. But with variants we gain access to new `transition` props like
`[when](./react-transitions#orchestration)`[, ](./react-
transitions#orchestration)`[delayChildren](./react-
transitions#orchestration)`[, ](./react-
transitions#orchestration)`[staggerChildren](./react-
transitions#orchestration)`[ and ](./react-
transitions#orchestration)`[staggerDirection](./react-
transitions#orchestration)`.

    
    
    const list = {
      visible: {
        opacity: 1,
        transition: {
          when: "beforeChildren",
          staggerChildren: 0.3, // Stagger children by .3 seconds
        },
      },
      hidden: {
        opacity: 0,
        transition: {
          when: "afterChildren",
        },
      },
    }

### Dynamic variants

Each variant can be defined as a function that resolves when a variant is made
active.

    
    
    const variants = {
      hidden: { opacity: 0 },
      visible: (index) => ({
        opacity: 1,
        transition: { delay: index * 0.3 }
      })
    }

These functions are provided a single argument, which is passed via the
`custom` prop:

    
    
    items.map((item, index) => <motion.div custom={index} variants={variants} />)

This way, variants can be resolved differently for each animating element.

## Animation controls

Declarative animations are ideal for most UI interactions. But sometimes we
need to take manual control over animation playback.

The `[useAnimate](./react-use-animate)`[ hook](./react-use-animate) can be
used for:

  * Animating any HTML/SVG element (not just `motion` components).

  * Complex animation sequences.

  * Controlling animations with `time`, `speed`, `play()`, `pause()` and other playback controls.

    
    
    function MyComponent() {
      const [scope, animate] = useAnimate()
    
      useEffect(() => {
        const controls = animate([
          [scope.current, { x: "100%" }],
          ["li", { opacity: 1 }]
        ])
    
        controls.speed = 0.8
    
        return () => controls.stop()
      }, [])
    
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

## Animate content

By passing [a ](./react-motion-value)`[MotionValue](./react-motion-value)` as
the child of a `motion` component, it will render its latest value in the
HTML.

    
    
    import { useMotionValue, motion, animate } from "motion/react"
    
    function Counter() {
      const count = useMotionValue(0)
    
      useEffect(() => {
        const controls = animate(count, 100, { duration: 5 })
        return () => controls.stop()
      }, [])
    
      return <motion.pre>{count}</motion.pre>
    }

This is more performant than setting React state as the `motion` component
will set `innerHTML` directly.

Motion for React offers a number of ways to animate your UI. Scaling from
extremely simple prop-based animations, to more complex orchestration.

## Basic animations

You'll perform almost all animations on [a ](./react-motion-
component)`[<motion />](./react-motion-component)`[ component](./react-motion-
component). This is basically a DOM element with motion superpowers.

    
    
    import { motion } from "motion/react"

For basic animations, you can update values on [the ](./react-motion-
component#animate)`[animate](./react-motion-component#animate)`[
prop](./react-motion-component#animate):

    
    
    <motion.div animate={{ opacity: 1 }} />

When any value in its animate prop changes, the component will automatically
animate to the new target.

## Animatable values

Motion can animate any CSS value, even those that can't be animated by
browsers, like `mask-image`. It supports:

  * Numbers: `0`, `100` etc.

  * Strings containing numbers: `"0vh"`, `"10px"` etc.

  * Colors: Hex, RGBA, HSLA.

  * Complex strings containing multiple numbers and/or colors (like `box-shadow`).

  * `display: "none"/"block"` and `visibility: "hidden"/"visible"`.

### Value type conversion

In general, values can only be animated between two of the same type (i.e
`"0px"` to `"100px"`).

Colors can be freely animated between hex, RGBA and HSLA types.

Additionally, `x`, `y`, `width`, `height`, `top`, `left`, `right` and `bottom`
can animate between different value types.

    
    
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: "calc(100vw - 50%)" }}
    />

It's also possible to animate `width` and `height` in to/out of `"auto"`.

    
    
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
    />

**Note:** If additionally animating `display` in to/out of `"none"`, replace
this with `visibility` `"hidden"` as elements with `display: none` can't be
measured.

### Transforms

Unlike CSS, Motion can animate every transform axis independently:

  * Translate: `x`, `y`, `z`

  * Scale: `scale`, `scaleX`, `scaleY`

  * Rotate: `rotate`, `rotateX`, `rotateY`, `rotateZ`

  * Skew: `skew`, `skewX`, `skewY`

  * Perspective: `transformPerspective`

`motion` components have enhanced `style` props, allowing you to set
individual transforms:

    
    
    <motion.section style={{ x: -20 }} />

Animating transforms independently provides great flexibility, especially
around gestures.

    
    
    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} />

Independent transforms perform great, but Motion's hybrid engine also uniquely
offers hardware acceleration by setting `transform` directly.

    
    
    <motion.li
      initial={{ transform: "translateX(-100px)" }}
      animate={{ transform: "translateX(0px)" }}
      transition={{ type: "spring" }}
    />

**SVG note:** For SVG components, `x` and `y` **attributes** can be set using
`attrX` and `attrY`.

### Transform origin

`transform-origin` has three shortcut values that can be set and animated
individually:

  * `originX`

  * `originY`

  * `originZ`

If set as numbers, `originX` and `Y` default to a progress value between `0`
and `1`. `originZ` defaults to pixels.

    
    
    <motion.div style={{ originX: 0.5 }} />

### CSS variables

Motion for React can animate the value of CSS variables, and also use CSS
variables as animation targets.

#### Animating CSS variables

Sometimes it's convenient to be able to animate a CSS variable to animate many
children:

    
    
    <motion.ul
      initial={{ '--rotate': '0deg' }}
      animate={{ '--rotate': '360deg' }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <li style={{ transform: 'rotate(var(--rotate))' }} />
      <li style={{ transform: 'rotate(var(--rotate))' }} />
      <li style={{ transform: 'rotate(var(--rotate))' }} />
    </motion.ul>

**Note:** Animating the value of a CSS variable **always triggers paint** ,
therefore it can be more performant to use `[MotionValue](./react-motion-
value)`[s](./react-motion-value) to setup this kind of animation.

### CSS variables as animation targets

HTML `motion` components accept animation targets with CSS variables:

    
    
    <motion.li animate={{ backgroundColor: "var(--action-bg)" }} />

#### SVG line drawing

Line drawing animations can be created with many different SVG elements using
three special properties: `pathLength`, `pathSpacing` and `pathOffset`.

    
    
    <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />

All three are set as a progress value between `0` and `1`, `1` representing
the total length of the path.

Path animations are compatible with `circle`, `ellipse`, `line`, `path`,
`polygon`, `polyline` and `rect` elements.

## Transitions

By default, Motion will create appropriate transitions for snappy animations
based on the type of value being animated.

For instance, physical properties like `x` or `scale` are animated with spring
physics, whereas values like `opacity` or `color` are animated with duration-
based easing curves.

However, you can define your own animations via [the ](./react-
transitions)`[transition](./react-transitions)`[ prop](./react-transitions).

    
    
    <motion.div
      animate={{ x: 100 }}
      transition={{ ease: "easeOut", duration: 2 }}
    />

## Enter animations

When a `motion` component is first created, it'll automatically animate to the
values in `animate` if they're different from those initially rendered, which
you can either do via CSS or via [the ](./react-motion-
value)`[initial](./react-motion-value)`[ prop.](./react-motion-value)

    
    
    <motion.li
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
    />

You can also disable the enter animation entirely by setting
`initial={false}`. This will make the element render with the values defined
in `animate`.

    
    
    <motion.div initial={false} animate={{ y: 100 }} />

## Exit animations

You can also easily animate elements as they exit the DOM.

In React, when a component is removed, it's usually removed instantly. Motion
provides [the ](./react-animate-presence)`[AnimatePresence](./react-animate-
presence)`[ component](./react-animate-presence) which keeps elements in the
DOM while they perform an `exit` animation.

    
    
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </AnimatePresence>

## Keyframes

Values in `animate` can be set as a series of keyframes. This will animate
through each value in sequence.

    
    
    <motion.div animate={{ x: [0, 100, 0] }} />

We can use a value's current state as the initial keyframe by setting it to
`null`.

    
    
    <motion.div animate={{ x: [null, 100, 0] }} />

This way, if a keyframe animation is interrupting another animation, the
transition will feel more natural.

By default, each keyframe is spaced naturally throughout the animation. You
can override this by setting [the ](./react-
transitions#times)`[times](./react-transitions#times)`[ option](./react-
transitions#times) via `transition`.

`times` is an array of progress values between `0` and `1`, defining where in
the animation each keyframe should be positioned.

    
    
    <motion.circle
      cx={500}
      animate={{
        cx: [null, 100, 200],
        transition: { duration: 3, times: [0, 0.2, 1] }
      }}
    />

## Gesture animations

Motion for React has shortcut props for animating to/from a target when a
gesture starts/ends.

    
    
    <motion.button
      initial={{ opacity: 0 }}
      whileHover={{ backgroundColor: "rgba(220, 220, 220, 1)" }}
      whileTap={{ backgroundColor: "rgba(255, 255, 255, 1)" }}
      whileInView={{ opacity: 1 }}
    />

It supports `hover`, `tap`, `drag`, `focus` and `inView`.

## Variants

Setting `animate` as a target is useful for simple, single-element animations.
But sometimes we want to orchestrate animations that propagate throughout the
DOM. We can do so with variants.

Variants are a set of named targets.

    
    
    const variants = {
      visible: { opacity: 1 },
      hidden: { opacity: 0 },
    }

They're passed to `motion` components via the `variants` prop:

    
    
    <motion.div variants={variants} />

These variants can now be referred to by a label, wherever you can define an
animation target:

    
    
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
    />

You can also define multiple variants via an array:

    
    
    animate={["visible", "danger"]}

> _I love using variants alongside React state – just pass your state to_`
> _animate_` _, and now you've got a tidy place to define all your animation
> targets!_
>  
>  
>      const [status, setStatus] = useState<"inactive" | "active" | "complete">(
>       "inactive"
>     );
>  
>     <motion.div
>       animate={status} // pass in our React state!
>       variants={{
>         inactive: { scale: 0.9 color: "var(--gray-500)" },
>         active: { scale: 1 color: "var(--blue-500)" },
>         complete: { scale: 1 color: "var(--blue-500)" }
>       }}
>     >
>       <motion.svg
>         path={checkmarkPath}
>         variants={{
>           inactive: { pathLength: 0 },
>           active: { pathLength: 0 },
>           complete: { pathLength: 1}
>         }}
>       />
>     </motion.div>
>
> ~ Sam Selikoff, [Motion for React
> Recipes](https://buildui.com/courses/framer-motion-recipes)

### Propagation

This is already useful for reusing and combining animation targets. But it
becomes powerful for orchestrating animations throughout trees.

Variants will flow down through `motion` components. So in this example when
the `ul` enters the viewport, all of its children with a "visible" variant
will also animate in:

    
    
    const list = {
      visible: { opacity: 1 },
      hidden: { opacity: 0 },
    }
    
    const item = {
      visible: { opacity: 1, x: 0 },
      hidden: { opacity: 0, x: -100 },
    }
    
    return (
      <motion.ul
        initial="hidden"
        whileInView="visible"
        variants={list}
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

### Orchestration

By default, this children animations will start simultaneously with the
parent. But with variants we gain access to new `transition` props like
`[when](./react-transitions#orchestration)`[, ](./react-
transitions#orchestration)`[delayChildren](./react-
transitions#orchestration)`[, ](./react-
transitions#orchestration)`[staggerChildren](./react-
transitions#orchestration)`[ and ](./react-
transitions#orchestration)`[staggerDirection](./react-
transitions#orchestration)`.

    
    
    const list = {
      visible: {
        opacity: 1,
        transition: {
          when: "beforeChildren",
          staggerChildren: 0.3, // Stagger children by .3 seconds
        },
      },
      hidden: {
        opacity: 0,
        transition: {
          when: "afterChildren",
        },
      },
    }

### Dynamic variants

Each variant can be defined as a function that resolves when a variant is made
active.

    
    
    const variants = {
      hidden: { opacity: 0 },
      visible: (index) => ({
        opacity: 1,
        transition: { delay: index * 0.3 }
      })
    }

These functions are provided a single argument, which is passed via the
`custom` prop:

    
    
    items.map((item, index) => <motion.div custom={index} variants={variants} />)

This way, variants can be resolved differently for each animating element.

## Animation controls

Declarative animations are ideal for most UI interactions. But sometimes we
need to take manual control over animation playback.

The `[useAnimate](./react-use-animate)`[ hook](./react-use-animate) can be
used for:

  * Animating any HTML/SVG element (not just `motion` components).

  * Complex animation sequences.

  * Controlling animations with `time`, `speed`, `play()`, `pause()` and other playback controls.

    
    
    function MyComponent() {
      const [scope, animate] = useAnimate()
    
      useEffect(() => {
        const controls = animate([
          [scope.current, { x: "100%" }],
          ["li", { opacity: 1 }]
        ])
    
        controls.speed = 0.8
    
        return () => controls.stop()
      }, [])
    
      return (
        <ul ref={scope}>
          <li />
          <li />
          <li />
        </ul>
      )
    }

## Animate content

By passing [a ](./react-motion-value)`[MotionValue](./react-motion-value)` as
the child of a `motion` component, it will render its latest value in the
HTML.

    
    
    import { useMotionValue, motion, animate } from "motion/react"
    
    function Counter() {
      const count = useMotionValue(0)
    
      useEffect(() => {
        const controls = animate(count, 100, { duration: 5 })
        return () => controls.stop()
      }, [])
    
      return <motion.pre>{count}</motion.pre>
    }

This is more performant than setting React state as the `motion` component
will set `innerHTML` directly.

React animation

Examples

## Go beyond the basics

[Motion+](../plus) is a one-time fee, lifetime membership.

As well as premium Motion features, early access content, and a private
Discord community, you'll unlock access to the source code of 90+ premium
examples that take the APIs on this page to the next level.

Loading...

Loading...

Loading...

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[Get Motion+](../plus#examples)

[Get started with Motion for React](./react-quick-start)

[Gestures](./react-gestures)

