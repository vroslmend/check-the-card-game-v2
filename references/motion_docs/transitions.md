# Transitions

Source: https://motion.dev/docs/react-transitions

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

Transitions

# Transitions

A `transition` defines the type of animation used when animating between two
values.

    
    
    const transition = {
      duration: 0.8,
      delay: 0.5,
      ease: [0, 0.71, 0.2, 1.01],
    }
    
    
    // Motion component
    <motion.div
      animate={{ x: 100 }}
      transition={transition}
    />
    
    // animate() function
    animate(".box", { x: 100 }, transition)

## Setting a transition

`transition` can be set on any animation prop, and that transition will be
used when the animation fires.

    
    
    <motion.div
      whileHover={{
        scale: 1.1,
        transition: { duration: 0.2 }
      }}
    />

### Value-specific transitions

When animating multiple values, each value can be animated with a different
transition, with `default` handling all other values:

    
    
    // Motion component
    <motion.li
      animate={{
        x: 0,
        opacity: 1,
        transition: {
          default: { type: "spring" },
          opacity: { ease: "linear" }
        }
      }}
    />
    
    // animate() function
    animate("li", { x: 0, opacity: 1 }, {
      default: { type: "spring" },
      opacity: { ease: "linear" }
    })

### Default transitions

It's possible to set default transitions via the `transition` prop. Either for
specific `motion` components:

    
    
    <motion.div
      animate={{ x: 100 }}
      transition={{ type: "spring", stiffness: 100 }}
    />

Or for a group of `motion` components [via ](./react-motion-
config#transition)`[MotionConfig](./react-motion-config#transition)`:

    
    
    <MotionConfig transition={{ duration: 0.4, ease: "easeInOut" }}>
      <App />
    </MotionConfig>

## Transition settings

#### `type`

**Default:** Dynamic

`type` decides the type of animation to use. It can be `"tween"`, `"spring"`
or `"inertia"`.

**Tween** animations are set with a duration and an easing curve.

**Spring** animations are either physics-based or duration-based.

Physics-based spring animations are set via `stiffness`, `damping` and `mass`,
and these incorporate the velocity of any existing gestures or animations for
natural feedback.

Duration-based spring animations are set via a `duration` and `bounce`. These
don't incorporate velocity but are easier to understand.

**Inertia** animations decelerate a value based on its initial velocity,
usually used to implement inertial scrolling.

    
    
    <motion.path
      animate={{ pathLength: 1 }}
      transition={{ duration: 2, type: "tween" }}
    />

#### Spring visualiser

TimePhysics

Duration

Bounce

Use visual duration

### Tween

#### `duration`

**Default:**`0.3` (or `0.8` if multiple keyframes are defined)

The duration of the animation. Can also be used for `"spring"` animations when
`bounce` is also set.

    
    
    animate("ul > li", { opacity: 1 }, { duration: 1 })

#### `ease`

The easing function to use with tween animations. Accepts:

  * Easing function name. E.g `"linear"`

  * An array of four numbers to define a cubic bezier curve. E.g `[.17,.67,.83,.67]`

  * A [JavaScript easing function](./easing-functions), that accepts and returns a value `0`-`1`.

These are the available easing function names:

  * `"linear"`

  * `"easeIn"`, `"easeOut"`, `"easeInOut"`

  * `"circIn"`, `"circOut"`, `"circInOut"`

  * `"backIn"`, `"backOut"`, `"backInOut"`

  * `"anticipate"`

When animating keyframes, `ease` can optionally be set as an array of easing
functions to set different easings between each value:

    
    
    <motion.div
      animate={{
        x: [0, 100, 0],
        transition: { ease: ["easeIn", "easeOut"] }
      }}
    />

> _I usually use the_` _"easeOut"_`_curve for enter and exit transitions. The
> acceleration at the beginning gives the user a feeling of responsiveness. I
> use a duration no longer than_` _0.3_` _/_`_0.4_` _seconds to keep the
> animation fast.  
>  
> _ ~ Emil Kowalski, [Animations on the Web](https://animations.dev/)

#### `times`

When animating multiple keyframes, `times` can be used to adjust the position
of each keyframe throughout the animation.

Each value in `times` is a value between `0` and `1`, representing the start
and end of the animation.

    
    
    <motion.div
      animate={{
        x: [0, 100, 0],
        transition: { times: [0, 0.3, 1] }
      }}
    />

There must be the same number of `times` as there are keyframes. Defaults to
an array of evenly-spread durations.

### Spring

#### `bounce`

**Default:** `0.25`

`bounce` determines the "bounciness" of a spring animation.

`0` is no bounce, and `1` is extremely bouncy.

**Note:** `bounce` and `duration` will be overridden if `stiffness`, `damping`
or `mass` are set.

    
    
    <motion.div
      animate={{ rotateX: 90 }}
      transition={{ type: "spring", bounce: 0.25 }}
    />

#### `visualDuration`

If `visualDuration` is set, this will override `duration`.

The visual duration is a time, **set in seconds** , that the animation will
take to visually appear to reach its target.

In other words, the bulk of the transition will occur before this time, and
the "bouncy bit" will mostly happen after.

This makes it easier to edit a spring, as well as visually coordinate it with
other time-based animations.

    
    
    <motion.div
      animate={{ rotateX: 90 }}
      transition={{
        type: "spring",
        visualDuration: 0.5,
        bounce: 0.25
      }}
    />

#### `damping`

**Default:** `10`

Strength of opposing force. If set to 0, spring will oscillate indefinitely.

    
    
    <motion.a
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', damping: 300 }}
    />

#### `mass`

**Default:** `1`

Mass of the moving object. Higher values will result in more lethargic
movement.

    
    
    <motion.feTurbulence
      animate={{ baseFrequency: 0.5 }}
      transition={{ type: "spring", mass: 0.5 }}
    />

#### `stiffness`

**Default:** `1`

Stiffness of the spring. Higher values will create more sudden movement.

    
    
    <motion.section
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', stiffness: 50 }}
    />

> _I never really understood how_` _damping_` _,_`_mass_` _and_` _stiffness_`
> _influence a spring animation, so I made a_[ _tool for
> myself_](https://emilkowal.ski/ui/great-animations#great-animations-feel-
> natural) _to visualise it.  
>  
> _ ~ Emil Kowalski, [Animations on the Web](https://animations.dev/)

#### `velocity`

**Default:** Current value velocity

The initial velocity of the spring.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', velocity: 2 }}
    />

#### `restSpeed`

**Default:** `0.1`

End animation if absolute speed (in units per second) drops below this value
and delta is smaller than `restDelta`.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', restSpeed: 0.5 }}
    />

#### `restDelta`

**Default:** `0.01`

End animation if distance is below this value and speed is below `restSpeed`.
When animation ends, the spring will end.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', restDelta: 0.5 }}
    />

### Inertia

An animation that decelerates a value based on its initial velocity.
Optionally, `min` and `max` boundaries can be defined, and inertia will snap
to these with a spring animation.

This animation will automatically precalculate a target value, which can be
modified with the `modifyTarget` property.

This allows you to add snap-to-grid or similar functionality.

Inertia is also the animation used for `dragTransition`, and can be configured
via that prop.

#### `power`

**Default:**`0.8`

A higher power value equals a further calculated target.

    
    
    <motion.div
      drag
      dragTransition={{ power: 0.2 }}
    />

#### `timeConstant`

**Default:**`**700**`

Adjusting the time constant will change the duration of the deceleration,
thereby affecting its feel.

    
    
    <motion.div
      drag
      dragTransition={{ timeConstant: 200 }}
    />

#### `modifyTarget`

A function that receives the automatically-calculated target and returns a new
one. Useful for snapping the target to a grid.

    
    
    <motion.div
      drag
      // dragTransition always type: inertia
      dragTransition={{
        power: 0,
        // Snap calculated target to nearest 50 pixels
        modifyTarget: target => Math.round(target / 50) * 50
      }}
    />

#### `min`

Minimum constraint. If set, the value will "bump" against this value (or
immediately spring to it if the animation starts as less than this value).

    
    
    <motion.div
      drag
      dragTransition={{ min: 0, max: 100 }}
    />

#### `max`

Maximum constraint. If set, the value will "bump" against this value (or
immediately snap to it, if the initial animation value exceeds this value).

    
    
    <motion.div
      drag
      dragTransition={{ min: 0, max: 100 }}
    />

#### `bounceStiffness`

**Default:**`500`

If `min` or `max` is set, this affects the stiffness of the bounce spring.
Higher values will create more sudden movement.

    
    
    <motion.div
      drag
      dragTransition={{
        min: 0,
        max: 100,
        bounceStiffness: 100
      }}
    />

#### `bounceDamping`

**Default:**`10`

If `min` or `max` is set, this affects the damping of the bounce spring. If
set to `0`, spring will oscillate indefinitely.

    
    
    <motion.div
      drag
      dragTransition={{
        min: 0,
        max: 100,
        bounceStiffness: 100
      }}
    />

### Orchestration

#### `delay`

**Default:**`0`

Delay the animation by this duration (in seconds).

    
    
    animate(element, { filter: "blur(10px)" }, { delay: 0.3 })

By setting `delay` to a negative value, the animation will start that long
into the animation. For instance to start 1 second in, `delay` can be set to
-`1`.

#### `repeat`

**Default:**`0`

The number of times to repeat the transition. Set to `Infinity` for perpetual
animation.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ repeat: Infinity, duration: 2 }}
    />

#### `repeatType`

**Default:**`"loop"`

How to repeat the animation. This can be either:

  * `loop`: Repeats the animation from the start.

  * `reverse`: Alternates between forward and backwards playback.

  * `mirror`: Switches animation origin and target on each iteration.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{
        repeat: 1,
        repeatType: "reverse",
        duration: 2
      }}
    />

#### `repeatDelay`

**Default:**`0`

When repeating an animation, `repeatDelay` will set the duration of the time
to wait, in seconds, between each repetition.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ repeat: Infinity, repeatDelay: 1 }}
    />

#### `when`

**Default:**`false`

With variants, describes when an animation should trigger, relative to that of
its children.

  * `"beforeChildren"`: Children animations will play after the parent animation finishes.

  * `"afterChildren"`: Parent animations will play after the children animations finish.

    
    
    const list = {
      hidden: {
        opacity: 0,
        transition: { when: "afterChildren" }
      }
    }
    
    const item = {
      hidden: {
        opacity: 0,
        transition: { duration: 2 }
      }
    }
    
    return (
      <motion.ul variants={list} animate="hidden">
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

#### `delayChildren`

**Default:**`0`

With variants, setting `delayChildren` on a parent will delay child animations
by this duration (in seconds).

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          delayChildren: 0.5
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

#### `staggerChildren`

**Default:**`0`

With variants, setting `staggerChildren` on a parent will stagger children by
this duration.

For example, if `staggerChildren` is set to `0.1`, the first child will
delayed by `0` seconds, the second by `0.1`, the third by `0.2` etc.

The calculated delay will be additional to `delayChildren`.

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.5
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ol
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ol>
    )

#### `staggerDirection`

**Default:**`1`

The direction in which to stagger children. `1` will stagger from the first to
last child, while `-1` staggers from last to first.

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          delayChildren: 0.5,
          staggerDirection: -1
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} size={50} />
        <motion.li variants={item} size={50} />
      </motion.ul>
    )

A `transition` defines the type of animation used when animating between two
values.

    
    
    const transition = {
      duration: 0.8,
      delay: 0.5,
      ease: [0, 0.71, 0.2, 1.01],
    }
    
    
    // Motion component
    <motion.div
      animate={{ x: 100 }}
      transition={transition}
    />
    
    // animate() function
    animate(".box", { x: 100 }, transition)

## Setting a transition

`transition` can be set on any animation prop, and that transition will be
used when the animation fires.

    
    
    <motion.div
      whileHover={{
        scale: 1.1,
        transition: { duration: 0.2 }
      }}
    />

### Value-specific transitions

When animating multiple values, each value can be animated with a different
transition, with `default` handling all other values:

    
    
    // Motion component
    <motion.li
      animate={{
        x: 0,
        opacity: 1,
        transition: {
          default: { type: "spring" },
          opacity: { ease: "linear" }
        }
      }}
    />
    
    // animate() function
    animate("li", { x: 0, opacity: 1 }, {
      default: { type: "spring" },
      opacity: { ease: "linear" }
    })

### Default transitions

It's possible to set default transitions via the `transition` prop. Either for
specific `motion` components:

    
    
    <motion.div
      animate={{ x: 100 }}
      transition={{ type: "spring", stiffness: 100 }}
    />

Or for a group of `motion` components [via ](./react-motion-
config#transition)`[MotionConfig](./react-motion-config#transition)`:

    
    
    <MotionConfig transition={{ duration: 0.4, ease: "easeInOut" }}>
      <App />
    </MotionConfig>

## Transition settings

#### `type`

**Default:** Dynamic

`type` decides the type of animation to use. It can be `"tween"`, `"spring"`
or `"inertia"`.

**Tween** animations are set with a duration and an easing curve.

**Spring** animations are either physics-based or duration-based.

Physics-based spring animations are set via `stiffness`, `damping` and `mass`,
and these incorporate the velocity of any existing gestures or animations for
natural feedback.

Duration-based spring animations are set via a `duration` and `bounce`. These
don't incorporate velocity but are easier to understand.

**Inertia** animations decelerate a value based on its initial velocity,
usually used to implement inertial scrolling.

    
    
    <motion.path
      animate={{ pathLength: 1 }}
      transition={{ duration: 2, type: "tween" }}
    />

#### Spring visualiser

TimePhysics

Duration

Bounce

Use visual duration

### Tween

#### `duration`

**Default:**`0.3` (or `0.8` if multiple keyframes are defined)

The duration of the animation. Can also be used for `"spring"` animations when
`bounce` is also set.

    
    
    animate("ul > li", { opacity: 1 }, { duration: 1 })

#### `ease`

The easing function to use with tween animations. Accepts:

  * Easing function name. E.g `"linear"`

  * An array of four numbers to define a cubic bezier curve. E.g `[.17,.67,.83,.67]`

  * A [JavaScript easing function](./easing-functions), that accepts and returns a value `0`-`1`.

These are the available easing function names:

  * `"linear"`

  * `"easeIn"`, `"easeOut"`, `"easeInOut"`

  * `"circIn"`, `"circOut"`, `"circInOut"`

  * `"backIn"`, `"backOut"`, `"backInOut"`

  * `"anticipate"`

When animating keyframes, `ease` can optionally be set as an array of easing
functions to set different easings between each value:

    
    
    <motion.div
      animate={{
        x: [0, 100, 0],
        transition: { ease: ["easeIn", "easeOut"] }
      }}
    />

> _I usually use the_` _"easeOut"_`_curve for enter and exit transitions. The
> acceleration at the beginning gives the user a feeling of responsiveness. I
> use a duration no longer than_` _0.3_` _/_`_0.4_` _seconds to keep the
> animation fast.  
>  
> _ ~ Emil Kowalski, [Animations on the Web](https://animations.dev/)

#### `times`

When animating multiple keyframes, `times` can be used to adjust the position
of each keyframe throughout the animation.

Each value in `times` is a value between `0` and `1`, representing the start
and end of the animation.

    
    
    <motion.div
      animate={{
        x: [0, 100, 0],
        transition: { times: [0, 0.3, 1] }
      }}
    />

There must be the same number of `times` as there are keyframes. Defaults to
an array of evenly-spread durations.

### Spring

#### `bounce`

**Default:** `0.25`

`bounce` determines the "bounciness" of a spring animation.

`0` is no bounce, and `1` is extremely bouncy.

**Note:** `bounce` and `duration` will be overridden if `stiffness`, `damping`
or `mass` are set.

    
    
    <motion.div
      animate={{ rotateX: 90 }}
      transition={{ type: "spring", bounce: 0.25 }}
    />

#### `visualDuration`

If `visualDuration` is set, this will override `duration`.

The visual duration is a time, **set in seconds** , that the animation will
take to visually appear to reach its target.

In other words, the bulk of the transition will occur before this time, and
the "bouncy bit" will mostly happen after.

This makes it easier to edit a spring, as well as visually coordinate it with
other time-based animations.

    
    
    <motion.div
      animate={{ rotateX: 90 }}
      transition={{
        type: "spring",
        visualDuration: 0.5,
        bounce: 0.25
      }}
    />

#### `damping`

**Default:** `10`

Strength of opposing force. If set to 0, spring will oscillate indefinitely.

    
    
    <motion.a
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', damping: 300 }}
    />

#### `mass`

**Default:** `1`

Mass of the moving object. Higher values will result in more lethargic
movement.

    
    
    <motion.feTurbulence
      animate={{ baseFrequency: 0.5 }}
      transition={{ type: "spring", mass: 0.5 }}
    />

#### `stiffness`

**Default:** `1`

Stiffness of the spring. Higher values will create more sudden movement.

    
    
    <motion.section
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', stiffness: 50 }}
    />

> _I never really understood how_` _damping_` _,_`_mass_` _and_` _stiffness_`
> _influence a spring animation, so I made a_[ _tool for
> myself_](https://emilkowal.ski/ui/great-animations#great-animations-feel-
> natural) _to visualise it.  
>  
> _ ~ Emil Kowalski, [Animations on the Web](https://animations.dev/)

#### `velocity`

**Default:** Current value velocity

The initial velocity of the spring.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', velocity: 2 }}
    />

#### `restSpeed`

**Default:** `0.1`

End animation if absolute speed (in units per second) drops below this value
and delta is smaller than `restDelta`.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', restSpeed: 0.5 }}
    />

#### `restDelta`

**Default:** `0.01`

End animation if distance is below this value and speed is below `restSpeed`.
When animation ends, the spring will end.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', restDelta: 0.5 }}
    />

### Inertia

An animation that decelerates a value based on its initial velocity.
Optionally, `min` and `max` boundaries can be defined, and inertia will snap
to these with a spring animation.

This animation will automatically precalculate a target value, which can be
modified with the `modifyTarget` property.

This allows you to add snap-to-grid or similar functionality.

Inertia is also the animation used for `dragTransition`, and can be configured
via that prop.

#### `power`

**Default:**`0.8`

A higher power value equals a further calculated target.

    
    
    <motion.div
      drag
      dragTransition={{ power: 0.2 }}
    />

#### `timeConstant`

**Default:**`**700**`

Adjusting the time constant will change the duration of the deceleration,
thereby affecting its feel.

    
    
    <motion.div
      drag
      dragTransition={{ timeConstant: 200 }}
    />

#### `modifyTarget`

A function that receives the automatically-calculated target and returns a new
one. Useful for snapping the target to a grid.

    
    
    <motion.div
      drag
      // dragTransition always type: inertia
      dragTransition={{
        power: 0,
        // Snap calculated target to nearest 50 pixels
        modifyTarget: target => Math.round(target / 50) * 50
      }}
    />

#### `min`

Minimum constraint. If set, the value will "bump" against this value (or
immediately spring to it if the animation starts as less than this value).

    
    
    <motion.div
      drag
      dragTransition={{ min: 0, max: 100 }}
    />

#### `max`

Maximum constraint. If set, the value will "bump" against this value (or
immediately snap to it, if the initial animation value exceeds this value).

    
    
    <motion.div
      drag
      dragTransition={{ min: 0, max: 100 }}
    />

#### `bounceStiffness`

**Default:**`500`

If `min` or `max` is set, this affects the stiffness of the bounce spring.
Higher values will create more sudden movement.

    
    
    <motion.div
      drag
      dragTransition={{
        min: 0,
        max: 100,
        bounceStiffness: 100
      }}
    />

#### `bounceDamping`

**Default:**`10`

If `min` or `max` is set, this affects the damping of the bounce spring. If
set to `0`, spring will oscillate indefinitely.

    
    
    <motion.div
      drag
      dragTransition={{
        min: 0,
        max: 100,
        bounceStiffness: 100
      }}
    />

### Orchestration

#### `delay`

**Default:**`0`

Delay the animation by this duration (in seconds).

    
    
    animate(element, { filter: "blur(10px)" }, { delay: 0.3 })

By setting `delay` to a negative value, the animation will start that long
into the animation. For instance to start 1 second in, `delay` can be set to
-`1`.

#### `repeat`

**Default:**`0`

The number of times to repeat the transition. Set to `Infinity` for perpetual
animation.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ repeat: Infinity, duration: 2 }}
    />

#### `repeatType`

**Default:**`"loop"`

How to repeat the animation. This can be either:

  * `loop`: Repeats the animation from the start.

  * `reverse`: Alternates between forward and backwards playback.

  * `mirror`: Switches animation origin and target on each iteration.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{
        repeat: 1,
        repeatType: "reverse",
        duration: 2
      }}
    />

#### `repeatDelay`

**Default:**`0`

When repeating an animation, `repeatDelay` will set the duration of the time
to wait, in seconds, between each repetition.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ repeat: Infinity, repeatDelay: 1 }}
    />

#### `when`

**Default:**`false`

With variants, describes when an animation should trigger, relative to that of
its children.

  * `"beforeChildren"`: Children animations will play after the parent animation finishes.

  * `"afterChildren"`: Parent animations will play after the children animations finish.

    
    
    const list = {
      hidden: {
        opacity: 0,
        transition: { when: "afterChildren" }
      }
    }
    
    const item = {
      hidden: {
        opacity: 0,
        transition: { duration: 2 }
      }
    }
    
    return (
      <motion.ul variants={list} animate="hidden">
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

#### `delayChildren`

**Default:**`0`

With variants, setting `delayChildren` on a parent will delay child animations
by this duration (in seconds).

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          delayChildren: 0.5
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

#### `staggerChildren`

**Default:**`0`

With variants, setting `staggerChildren` on a parent will stagger children by
this duration.

For example, if `staggerChildren` is set to `0.1`, the first child will
delayed by `0` seconds, the second by `0.1`, the third by `0.2` etc.

The calculated delay will be additional to `delayChildren`.

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.5
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ol
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ol>
    )

#### `staggerDirection`

**Default:**`1`

The direction in which to stagger children. `1` will stagger from the first to
last child, while `-1` staggers from last to first.

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          delayChildren: 0.5,
          staggerDirection: -1
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} size={50} />
        <motion.li variants={item} size={50} />
      </motion.ul>
    )

A `transition` defines the type of animation used when animating between two
values.

    
    
    const transition = {
      duration: 0.8,
      delay: 0.5,
      ease: [0, 0.71, 0.2, 1.01],
    }
    
    
    // Motion component
    <motion.div
      animate={{ x: 100 }}
      transition={transition}
    />
    
    // animate() function
    animate(".box", { x: 100 }, transition)

## Setting a transition

`transition` can be set on any animation prop, and that transition will be
used when the animation fires.

    
    
    <motion.div
      whileHover={{
        scale: 1.1,
        transition: { duration: 0.2 }
      }}
    />

### Value-specific transitions

When animating multiple values, each value can be animated with a different
transition, with `default` handling all other values:

    
    
    // Motion component
    <motion.li
      animate={{
        x: 0,
        opacity: 1,
        transition: {
          default: { type: "spring" },
          opacity: { ease: "linear" }
        }
      }}
    />
    
    // animate() function
    animate("li", { x: 0, opacity: 1 }, {
      default: { type: "spring" },
      opacity: { ease: "linear" }
    })

### Default transitions

It's possible to set default transitions via the `transition` prop. Either for
specific `motion` components:

    
    
    <motion.div
      animate={{ x: 100 }}
      transition={{ type: "spring", stiffness: 100 }}
    />

Or for a group of `motion` components [via ](./react-motion-
config#transition)`[MotionConfig](./react-motion-config#transition)`:

    
    
    <MotionConfig transition={{ duration: 0.4, ease: "easeInOut" }}>
      <App />
    </MotionConfig>

## Transition settings

#### `type`

**Default:** Dynamic

`type` decides the type of animation to use. It can be `"tween"`, `"spring"`
or `"inertia"`.

**Tween** animations are set with a duration and an easing curve.

**Spring** animations are either physics-based or duration-based.

Physics-based spring animations are set via `stiffness`, `damping` and `mass`,
and these incorporate the velocity of any existing gestures or animations for
natural feedback.

Duration-based spring animations are set via a `duration` and `bounce`. These
don't incorporate velocity but are easier to understand.

**Inertia** animations decelerate a value based on its initial velocity,
usually used to implement inertial scrolling.

    
    
    <motion.path
      animate={{ pathLength: 1 }}
      transition={{ duration: 2, type: "tween" }}
    />

#### Spring visualiser

TimePhysics

Duration

Bounce

Use visual duration

### Tween

#### `duration`

**Default:**`0.3` (or `0.8` if multiple keyframes are defined)

The duration of the animation. Can also be used for `"spring"` animations when
`bounce` is also set.

    
    
    animate("ul > li", { opacity: 1 }, { duration: 1 })

#### `ease`

The easing function to use with tween animations. Accepts:

  * Easing function name. E.g `"linear"`

  * An array of four numbers to define a cubic bezier curve. E.g `[.17,.67,.83,.67]`

  * A [JavaScript easing function](./easing-functions), that accepts and returns a value `0`-`1`.

These are the available easing function names:

  * `"linear"`

  * `"easeIn"`, `"easeOut"`, `"easeInOut"`

  * `"circIn"`, `"circOut"`, `"circInOut"`

  * `"backIn"`, `"backOut"`, `"backInOut"`

  * `"anticipate"`

When animating keyframes, `ease` can optionally be set as an array of easing
functions to set different easings between each value:

    
    
    <motion.div
      animate={{
        x: [0, 100, 0],
        transition: { ease: ["easeIn", "easeOut"] }
      }}
    />

> _I usually use the_` _"easeOut"_`_curve for enter and exit transitions. The
> acceleration at the beginning gives the user a feeling of responsiveness. I
> use a duration no longer than_` _0.3_` _/_`_0.4_` _seconds to keep the
> animation fast.  
>  
> _ ~ Emil Kowalski, [Animations on the Web](https://animations.dev/)

#### `times`

When animating multiple keyframes, `times` can be used to adjust the position
of each keyframe throughout the animation.

Each value in `times` is a value between `0` and `1`, representing the start
and end of the animation.

    
    
    <motion.div
      animate={{
        x: [0, 100, 0],
        transition: { times: [0, 0.3, 1] }
      }}
    />

There must be the same number of `times` as there are keyframes. Defaults to
an array of evenly-spread durations.

### Spring

#### `bounce`

**Default:** `0.25`

`bounce` determines the "bounciness" of a spring animation.

`0` is no bounce, and `1` is extremely bouncy.

**Note:** `bounce` and `duration` will be overridden if `stiffness`, `damping`
or `mass` are set.

    
    
    <motion.div
      animate={{ rotateX: 90 }}
      transition={{ type: "spring", bounce: 0.25 }}
    />

#### `visualDuration`

If `visualDuration` is set, this will override `duration`.

The visual duration is a time, **set in seconds** , that the animation will
take to visually appear to reach its target.

In other words, the bulk of the transition will occur before this time, and
the "bouncy bit" will mostly happen after.

This makes it easier to edit a spring, as well as visually coordinate it with
other time-based animations.

    
    
    <motion.div
      animate={{ rotateX: 90 }}
      transition={{
        type: "spring",
        visualDuration: 0.5,
        bounce: 0.25
      }}
    />

#### `damping`

**Default:** `10`

Strength of opposing force. If set to 0, spring will oscillate indefinitely.

    
    
    <motion.a
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', damping: 300 }}
    />

#### `mass`

**Default:** `1`

Mass of the moving object. Higher values will result in more lethargic
movement.

    
    
    <motion.feTurbulence
      animate={{ baseFrequency: 0.5 }}
      transition={{ type: "spring", mass: 0.5 }}
    />

#### `stiffness`

**Default:** `1`

Stiffness of the spring. Higher values will create more sudden movement.

    
    
    <motion.section
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', stiffness: 50 }}
    />

> _I never really understood how_` _damping_` _,_`_mass_` _and_` _stiffness_`
> _influence a spring animation, so I made a_[ _tool for
> myself_](https://emilkowal.ski/ui/great-animations#great-animations-feel-
> natural) _to visualise it.  
>  
> _ ~ Emil Kowalski, [Animations on the Web](https://animations.dev/)

#### `velocity`

**Default:** Current value velocity

The initial velocity of the spring.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', velocity: 2 }}
    />

#### `restSpeed`

**Default:** `0.1`

End animation if absolute speed (in units per second) drops below this value
and delta is smaller than `restDelta`.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', restSpeed: 0.5 }}
    />

#### `restDelta`

**Default:** `0.01`

End animation if distance is below this value and speed is below `restSpeed`.
When animation ends, the spring will end.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ type: 'spring', restDelta: 0.5 }}
    />

### Inertia

An animation that decelerates a value based on its initial velocity.
Optionally, `min` and `max` boundaries can be defined, and inertia will snap
to these with a spring animation.

This animation will automatically precalculate a target value, which can be
modified with the `modifyTarget` property.

This allows you to add snap-to-grid or similar functionality.

Inertia is also the animation used for `dragTransition`, and can be configured
via that prop.

#### `power`

**Default:**`0.8`

A higher power value equals a further calculated target.

    
    
    <motion.div
      drag
      dragTransition={{ power: 0.2 }}
    />

#### `timeConstant`

**Default:**`**700**`

Adjusting the time constant will change the duration of the deceleration,
thereby affecting its feel.

    
    
    <motion.div
      drag
      dragTransition={{ timeConstant: 200 }}
    />

#### `modifyTarget`

A function that receives the automatically-calculated target and returns a new
one. Useful for snapping the target to a grid.

    
    
    <motion.div
      drag
      // dragTransition always type: inertia
      dragTransition={{
        power: 0,
        // Snap calculated target to nearest 50 pixels
        modifyTarget: target => Math.round(target / 50) * 50
      }}
    />

#### `min`

Minimum constraint. If set, the value will "bump" against this value (or
immediately spring to it if the animation starts as less than this value).

    
    
    <motion.div
      drag
      dragTransition={{ min: 0, max: 100 }}
    />

#### `max`

Maximum constraint. If set, the value will "bump" against this value (or
immediately snap to it, if the initial animation value exceeds this value).

    
    
    <motion.div
      drag
      dragTransition={{ min: 0, max: 100 }}
    />

#### `bounceStiffness`

**Default:**`500`

If `min` or `max` is set, this affects the stiffness of the bounce spring.
Higher values will create more sudden movement.

    
    
    <motion.div
      drag
      dragTransition={{
        min: 0,
        max: 100,
        bounceStiffness: 100
      }}
    />

#### `bounceDamping`

**Default:**`10`

If `min` or `max` is set, this affects the damping of the bounce spring. If
set to `0`, spring will oscillate indefinitely.

    
    
    <motion.div
      drag
      dragTransition={{
        min: 0,
        max: 100,
        bounceStiffness: 100
      }}
    />

### Orchestration

#### `delay`

**Default:**`0`

Delay the animation by this duration (in seconds).

    
    
    animate(element, { filter: "blur(10px)" }, { delay: 0.3 })

By setting `delay` to a negative value, the animation will start that long
into the animation. For instance to start 1 second in, `delay` can be set to
-`1`.

#### `repeat`

**Default:**`0`

The number of times to repeat the transition. Set to `Infinity` for perpetual
animation.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ repeat: Infinity, duration: 2 }}
    />

#### `repeatType`

**Default:**`"loop"`

How to repeat the animation. This can be either:

  * `loop`: Repeats the animation from the start.

  * `reverse`: Alternates between forward and backwards playback.

  * `mirror`: Switches animation origin and target on each iteration.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{
        repeat: 1,
        repeatType: "reverse",
        duration: 2
      }}
    />

#### `repeatDelay`

**Default:**`0`

When repeating an animation, `repeatDelay` will set the duration of the time
to wait, in seconds, between each repetition.

    
    
    <motion.div
      animate={{ rotate: 180 }}
      transition={{ repeat: Infinity, repeatDelay: 1 }}
    />

#### `when`

**Default:**`false`

With variants, describes when an animation should trigger, relative to that of
its children.

  * `"beforeChildren"`: Children animations will play after the parent animation finishes.

  * `"afterChildren"`: Parent animations will play after the children animations finish.

    
    
    const list = {
      hidden: {
        opacity: 0,
        transition: { when: "afterChildren" }
      }
    }
    
    const item = {
      hidden: {
        opacity: 0,
        transition: { duration: 2 }
      }
    }
    
    return (
      <motion.ul variants={list} animate="hidden">
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

#### `delayChildren`

**Default:**`0`

With variants, setting `delayChildren` on a parent will delay child animations
by this duration (in seconds).

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          delayChildren: 0.5
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ul>
    )

#### `staggerChildren`

**Default:**`0`

With variants, setting `staggerChildren` on a parent will stagger children by
this duration.

For example, if `staggerChildren` is set to `0.1`, the first child will
delayed by `0` seconds, the second by `0.1`, the third by `0.2` etc.

The calculated delay will be additional to `delayChildren`.

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.5
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ol
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} />
        <motion.li variants={item} />
      </motion.ol>
    )

#### `staggerDirection`

**Default:**`1`

The direction in which to stagger children. `1` will stagger from the first to
last child, while `-1` staggers from last to first.

    
    
    const container = {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          delayChildren: 0.5,
          staggerDirection: -1
        }
      }
    }
    
    const item = {
      hidden: { opacity: 0 },
      show: { opacity: 1 }
    }
    
    return (
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.li variants={item} size={50} />
        <motion.li variants={item} size={50} />
      </motion.ul>
    )

Transitions

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

[Scroll animations](./react-scroll-animations)

[motion](./react-motion-component)

