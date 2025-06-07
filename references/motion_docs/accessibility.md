# Accessibility

Source: https://motion.dev/docs/react-accessibility

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

Accessibility

# Accessibility

Animations can have serious usability implications, even inducing motion
sickness in some people.

All modern operating systems provide a setting called "Reduced Motion", where
people can indicate they prefer less physical motion, either because of
personal preference or because they can suffer from motion sickness.

There are already some excellent guides about _why_ and _how_ we should design
accessible animations, like those at [A List
Apart](http://alistapart.com/article/designing-safer-web-animation-for-motion-
sensitivity/) and [Smashing
Magazine](https://www.smashingmagazine.com/2018/04/designing-accessibility-
inclusion/). The main takeaways are that for users with "Reduced Motion"
enabled, we should keep educational transitions but be aware of motion
sickness.

That means replacing transform animations on large elements with opacity
transitions, disabling auto-playing videos, and disabling parallax animations.

Motion for React provides APIs that make it simple to respect these people's
preferences. In this guide, we'll learn how to use the `reducedMotion` option
and `useReducedMotion` hook to make our animations accessible.

## Automatic

The `[reducedMotion](./react-motion-config)` option can be set on
`MotionConfig` to define how you want to adhere to the Reduced Motion setting.

By setting `reducedMotion` it to `"user"`, all `motion` components will
**automatically** disable transform and layout animations, while preserving
the animation of other values like `opacity` and `backgroundColor`.

    
    
    import { MotionConfig } from "framer-motion"
    
    export function App({ children }) {
      return (
        <MotionConfig reducedMotion="user">
          {children}
        </MotionConfig>
      )
    }

[Framer](https://framer.com), the no-code site builder, uses this API and
exposes it via a setting in `Site Settings > Accessibility`.

Additionally, you can allow a user to override Reduced Motion for just your
site by setting reducedMotion to `"always"` or `"never"` based on their
profile.

    
    
    <MotionConfig reducedMotion={userSetting}>

## Manual

While `reducedMotion` is a great blanket tool for ensuring accessible
animations across your whole site, more bespoke solutions can be created with
[the ](./react-use-reduced-motion)`[useReducedMotion](./react-use-reduced-
motion)`[ hook](./react-use-reduced-motion).

This hook returns `true`/`false` depending on whether your visitor has Reduced
Motion enabled.

    
    
    import { useReducedMotion } from "framer-motion"
    
    // In your componentconst
    shouldReduceMotion = useReducedMotion()

We can use this boolean to fix some of the common accessibility problems, like
the following.

### Replace `transform` with `opacity`

When Reduced Motion is enabled on iOS, the operating system still animates
between states to help users transition between each context. But instead of
the default scale and x/y animations, it fades content in and out.

We can achieve this in Motion by passing different values to `animate` based
on whether `useReducedMotion` returns `true` or not.

    
    
    function Sidebar({ isOpen }) {
      const shouldReduceMotion = useReducedMotion()
      let animate
    
      if (isOpen) {
        animate = shouldReduceMotion ? { opacity: 1 } : { x: 0 }
      } else {
        animate = shouldReduceMotion
          ? { opacity: 0 }
          : { x: "-100%" }
      }
    
      return <motion.div animate={animate} />
    }

### Disable auto-playing video

`useReducedMotion` isn’t only compatible with the Motion. It returns a simple
boolean, so you can use it for any purpose, like disabling the autoplay of a
background `video` element:

    
    
    function BackgroundVideo() {
      const shouldReduceMotion = useReducedMotion()
    
      return <video autoplay={!shouldReduceMotion} />
    }

### Disable parallax

Parallax animations can be very unpleasant for people pre-disposed to motion
sickness.

To build parallax, we usually get `scrollY` from `useViewportScroll`, and
create a new `MotionValue` via passing that to `useTransform` which will
update's a `motion` component's `y` position as the scroll value changes.

To disable this for reduced motion devices, we can conditionally pass this
`MotionValue` to the animating element.

    
    
    function Parallax() {
      const shouldReduceMotion = useReducedMotion()
      const { scrollY } = useViewportScroll()
    
      const y = useTransform(scrollY, [0, 1], [0, -0.2], {
        clamp: false,
      })
    
      return (
        <motion.div style={{ y: shouldReduceMotion ? 0 : y }} />
      )
    }

## Conclusion

We've learned to respect people's Reduced Motion setting with Motion for
React. The `reducedMotion` option makes it simple to implement across a whole
site, while `useReducedMotion` can help us create bespoke accessibility
strategies with any React API.

Animations can have serious usability implications, even inducing motion
sickness in some people.

All modern operating systems provide a setting called "Reduced Motion", where
people can indicate they prefer less physical motion, either because of
personal preference or because they can suffer from motion sickness.

There are already some excellent guides about _why_ and _how_ we should design
accessible animations, like those at [A List
Apart](http://alistapart.com/article/designing-safer-web-animation-for-motion-
sensitivity/) and [Smashing
Magazine](https://www.smashingmagazine.com/2018/04/designing-accessibility-
inclusion/). The main takeaways are that for users with "Reduced Motion"
enabled, we should keep educational transitions but be aware of motion
sickness.

That means replacing transform animations on large elements with opacity
transitions, disabling auto-playing videos, and disabling parallax animations.

Motion for React provides APIs that make it simple to respect these people's
preferences. In this guide, we'll learn how to use the `reducedMotion` option
and `useReducedMotion` hook to make our animations accessible.

## Automatic

The `[reducedMotion](./react-motion-config)` option can be set on
`MotionConfig` to define how you want to adhere to the Reduced Motion setting.

By setting `reducedMotion` it to `"user"`, all `motion` components will
**automatically** disable transform and layout animations, while preserving
the animation of other values like `opacity` and `backgroundColor`.

    
    
    import { MotionConfig } from "framer-motion"
    
    export function App({ children }) {
      return (
        <MotionConfig reducedMotion="user">
          {children}
        </MotionConfig>
      )
    }

[Framer](https://framer.com), the no-code site builder, uses this API and
exposes it via a setting in `Site Settings > Accessibility`.

Additionally, you can allow a user to override Reduced Motion for just your
site by setting reducedMotion to `"always"` or `"never"` based on their
profile.

    
    
    <MotionConfig reducedMotion={userSetting}>

## Manual

While `reducedMotion` is a great blanket tool for ensuring accessible
animations across your whole site, more bespoke solutions can be created with
[the ](./react-use-reduced-motion)`[useReducedMotion](./react-use-reduced-
motion)`[ hook](./react-use-reduced-motion).

This hook returns `true`/`false` depending on whether your visitor has Reduced
Motion enabled.

    
    
    import { useReducedMotion } from "framer-motion"
    
    // In your componentconst
    shouldReduceMotion = useReducedMotion()

We can use this boolean to fix some of the common accessibility problems, like
the following.

### Replace `transform` with `opacity`

When Reduced Motion is enabled on iOS, the operating system still animates
between states to help users transition between each context. But instead of
the default scale and x/y animations, it fades content in and out.

We can achieve this in Motion by passing different values to `animate` based
on whether `useReducedMotion` returns `true` or not.

    
    
    function Sidebar({ isOpen }) {
      const shouldReduceMotion = useReducedMotion()
      let animate
    
      if (isOpen) {
        animate = shouldReduceMotion ? { opacity: 1 } : { x: 0 }
      } else {
        animate = shouldReduceMotion
          ? { opacity: 0 }
          : { x: "-100%" }
      }
    
      return <motion.div animate={animate} />
    }

### Disable auto-playing video

`useReducedMotion` isn’t only compatible with the Motion. It returns a simple
boolean, so you can use it for any purpose, like disabling the autoplay of a
background `video` element:

    
    
    function BackgroundVideo() {
      const shouldReduceMotion = useReducedMotion()
    
      return <video autoplay={!shouldReduceMotion} />
    }

### Disable parallax

Parallax animations can be very unpleasant for people pre-disposed to motion
sickness.

To build parallax, we usually get `scrollY` from `useViewportScroll`, and
create a new `MotionValue` via passing that to `useTransform` which will
update's a `motion` component's `y` position as the scroll value changes.

To disable this for reduced motion devices, we can conditionally pass this
`MotionValue` to the animating element.

    
    
    function Parallax() {
      const shouldReduceMotion = useReducedMotion()
      const { scrollY } = useViewportScroll()
    
      const y = useTransform(scrollY, [0, 1], [0, -0.2], {
        clamp: false,
      })
    
      return (
        <motion.div style={{ y: shouldReduceMotion ? 0 : y }} />
      )
    }

## Conclusion

We've learned to respect people's Reduced Motion setting with Motion for
React. The `reducedMotion` option makes it simple to implement across a whole
site, while `useReducedMotion` can help us create bespoke accessibility
strategies with any React API.

Animations can have serious usability implications, even inducing motion
sickness in some people.

All modern operating systems provide a setting called "Reduced Motion", where
people can indicate they prefer less physical motion, either because of
personal preference or because they can suffer from motion sickness.

There are already some excellent guides about _why_ and _how_ we should design
accessible animations, like those at [A List
Apart](http://alistapart.com/article/designing-safer-web-animation-for-motion-
sensitivity/) and [Smashing
Magazine](https://www.smashingmagazine.com/2018/04/designing-accessibility-
inclusion/). The main takeaways are that for users with "Reduced Motion"
enabled, we should keep educational transitions but be aware of motion
sickness.

That means replacing transform animations on large elements with opacity
transitions, disabling auto-playing videos, and disabling parallax animations.

Motion for React provides APIs that make it simple to respect these people's
preferences. In this guide, we'll learn how to use the `reducedMotion` option
and `useReducedMotion` hook to make our animations accessible.

## Automatic

The `[reducedMotion](./react-motion-config)` option can be set on
`MotionConfig` to define how you want to adhere to the Reduced Motion setting.

By setting `reducedMotion` it to `"user"`, all `motion` components will
**automatically** disable transform and layout animations, while preserving
the animation of other values like `opacity` and `backgroundColor`.

    
    
    import { MotionConfig } from "framer-motion"
    
    export function App({ children }) {
      return (
        <MotionConfig reducedMotion="user">
          {children}
        </MotionConfig>
      )
    }

[Framer](https://framer.com), the no-code site builder, uses this API and
exposes it via a setting in `Site Settings > Accessibility`.

Additionally, you can allow a user to override Reduced Motion for just your
site by setting reducedMotion to `"always"` or `"never"` based on their
profile.

    
    
    <MotionConfig reducedMotion={userSetting}>

## Manual

While `reducedMotion` is a great blanket tool for ensuring accessible
animations across your whole site, more bespoke solutions can be created with
[the ](./react-use-reduced-motion)`[useReducedMotion](./react-use-reduced-
motion)`[ hook](./react-use-reduced-motion).

This hook returns `true`/`false` depending on whether your visitor has Reduced
Motion enabled.

    
    
    import { useReducedMotion } from "framer-motion"
    
    // In your componentconst
    shouldReduceMotion = useReducedMotion()

We can use this boolean to fix some of the common accessibility problems, like
the following.

### Replace `transform` with `opacity`

When Reduced Motion is enabled on iOS, the operating system still animates
between states to help users transition between each context. But instead of
the default scale and x/y animations, it fades content in and out.

We can achieve this in Motion by passing different values to `animate` based
on whether `useReducedMotion` returns `true` or not.

    
    
    function Sidebar({ isOpen }) {
      const shouldReduceMotion = useReducedMotion()
      let animate
    
      if (isOpen) {
        animate = shouldReduceMotion ? { opacity: 1 } : { x: 0 }
      } else {
        animate = shouldReduceMotion
          ? { opacity: 0 }
          : { x: "-100%" }
      }
    
      return <motion.div animate={animate} />
    }

### Disable auto-playing video

`useReducedMotion` isn’t only compatible with the Motion. It returns a simple
boolean, so you can use it for any purpose, like disabling the autoplay of a
background `video` element:

    
    
    function BackgroundVideo() {
      const shouldReduceMotion = useReducedMotion()
    
      return <video autoplay={!shouldReduceMotion} />
    }

### Disable parallax

Parallax animations can be very unpleasant for people pre-disposed to motion
sickness.

To build parallax, we usually get `scrollY` from `useViewportScroll`, and
create a new `MotionValue` via passing that to `useTransform` which will
update's a `motion` component's `y` position as the scroll value changes.

To disable this for reduced motion devices, we can conditionally pass this
`MotionValue` to the animating element.

    
    
    function Parallax() {
      const shouldReduceMotion = useReducedMotion()
      const { scrollY } = useViewportScroll()
    
      const y = useTransform(scrollY, [0, 1], [0, -0.2], {
        clamp: false,
      })
    
      return (
        <motion.div style={{ y: shouldReduceMotion ? 0 : y }} />
      )
    }

## Conclusion

We've learned to respect people's Reduced Motion setting with Motion for
React. The `reducedMotion` option makes it simple to implement across a whole
site, while `useReducedMotion` can help us create bespoke accessibility
strategies with any React API.

[useReducedMotion](./react-use-reduced-motion)

[Reduce bundle size](./react-reduce-bundle-size)

