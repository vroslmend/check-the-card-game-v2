# Reduce bundle size

Source: https://motion.dev/docs/react-reduce-bundle-size

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

Reduce bundle size

# Reduce bundle size

A great web experience doesn't just look and move beautifully, it should load
quickly, too.

When measuring the gzipped and minified size of Motion for React using a
bundle analysis website like
[Bundlephobia](https://bundlephobia.com/package/framer-motion@7.2.0), you
might see big numbers like **50kb** or more!

This is misleading. Motion for React exports many functions, most of which you
won't import. JavaScript bundlers like [Rollup](https://rollupjs.org/) and
[Webpack](https://webpack.js.org/) are capable of "tree shaking", which means
that only the code you import is shipped to consumers.

You may only use a tiny, single hook from Motion for React, like
`useReducedMotion`. So in that case the size would be closer to **1kb**.

However, Motion for React's primary animation APIs are `useAnimate` and
`motion`. Most developers will choose to use at least one of these when using
Motion, so let's see how to make them as small as possible.

## `useAnimate`

`[useAnimate](./react-use-animate)` is Motion for React's animation function,
used for manually triggering and controlling animations.

It comes in two sizes, **mini** (2.3kb) and **hybrid** (17kb).

The mini version exclusively uses WAAPI for hardware accelerated animations,
whereas the hybrid function can also animate sequences, motion values,
independent transforms and a whole lot more.

At 2.3kb, `useAnimate` mini is the smallest animation library available for
React.

## `motion`

The `[motion](./react-motion-component)`[ component](./react-motion-component)
is Motion for React's most common animation API.

Because of its declarative, props-driven API, it's impossible for bundlers to
tree shake it any smaller than **34kb**.

However, by using [the ](./react-lazy-motion)`[m](./react-lazy-motion)`[ and
](./react-lazy-motion)`[LazyMotion](./react-lazy-motion)`[
components](./react-lazy-motion), you can bring this down significantly, to
just under **6kb** for the initial render.

Then, with lazy-loading, you can defer the loading of animations and
interactions until after your site has rendered.

**Note:** All sizes quoted in this guide are from Rollup-generated bundles.
Webpack is less effective at tree-shaking and should generate slightly larger
bundles.

### Reduce size

Instead of importing `motion`, import the slimmer `m` component.

    
    
    import * as m from "motion/react-m"

`m` is used in the exact same way as `motion`, but unlike `motion`, the `m`
component doesn't come preloaded with features like animations, layout
animations, or the drag gesture.

Instead, we load these in manually via the `LazyMotion` component. This lets
you choose which features you load in, and whether you load them as part of
the main bundle, or lazy load them.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    
    // Load only the domAnimation package
    function App({ children }) {
      return (
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      )
    }

### Available features

There are currently two **feature packages** you can load:

  * `domAnimation`: This provides support for animations, variants, exit animations, and tap/hover/focus gestures. (**+15kb**)

  * `domMax`: This provides support for all of the above, plus pan/drag gestures and layout animations. (**+25kb**)

In the future it might be possible to offer more granular feature packages,
but for now these were chosen to reduce the amount of duplication between
features, which could result in much more data being downloaded ultimately.

### Synchronous loading

By passing one of these feature packages to `LazyMotion`, they'll be bundled
into your main JavaScript bundle.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    
    function App({ children }) {
      return (
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      )
    }

### Lazy loading

If you're using a bundler like Webpack or Rollup, we can pass a dynamic import
function to `features` that will fetch features only after we've performed our
initial render.

First, create a file that exports only the features you want to load.

    
    
    // features.js
    import { domMax } from "motion/react"
    export default domMax

Then, pass `features` a function that will dynamically load that file.

    
    
    import { LazyMotion } from "motion/react"
    import * as m from "motion/react-m"
    
    // Make sure to return the specific export containing the feature bundle.
    const loadFeatures = () =>
      import("./features.js").then(res => res.default)
    
    // This animation will run when loadFeatures resolves.
    function App() {
      return (
        <LazyMotion features={loadFeatures}>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        </LazyMotion>
      )
    }

### Strict mode

Because the normal `motion` component still preloads all of its functionality,
including it anywhere will break the benefits of using `LazyMotion`.

To help prevent this, the `strict` prop can be set on `LazyMotion`. If a
`motion` component is loaded anywhere within, it will throw with a reminder to
render the `m` component instead.

    
    
    function App() {
      // This will throw!
      return (
        <LazyMotion strict>
          <motion.div />
        </LazyMotion>
      )
    }

A great web experience doesn't just look and move beautifully, it should load
quickly, too.

When measuring the gzipped and minified size of Motion for React using a
bundle analysis website like
[Bundlephobia](https://bundlephobia.com/package/framer-motion@7.2.0), you
might see big numbers like **50kb** or more!

This is misleading. Motion for React exports many functions, most of which you
won't import. JavaScript bundlers like [Rollup](https://rollupjs.org/) and
[Webpack](https://webpack.js.org/) are capable of "tree shaking", which means
that only the code you import is shipped to consumers.

You may only use a tiny, single hook from Motion for React, like
`useReducedMotion`. So in that case the size would be closer to **1kb**.

However, Motion for React's primary animation APIs are `useAnimate` and
`motion`. Most developers will choose to use at least one of these when using
Motion, so let's see how to make them as small as possible.

## `useAnimate`

`[useAnimate](./react-use-animate)` is Motion for React's animation function,
used for manually triggering and controlling animations.

It comes in two sizes, **mini** (2.3kb) and **hybrid** (17kb).

The mini version exclusively uses WAAPI for hardware accelerated animations,
whereas the hybrid function can also animate sequences, motion values,
independent transforms and a whole lot more.

At 2.3kb, `useAnimate` mini is the smallest animation library available for
React.

## `motion`

The `[motion](./react-motion-component)`[ component](./react-motion-component)
is Motion for React's most common animation API.

Because of its declarative, props-driven API, it's impossible for bundlers to
tree shake it any smaller than **34kb**.

However, by using [the ](./react-lazy-motion)`[m](./react-lazy-motion)`[ and
](./react-lazy-motion)`[LazyMotion](./react-lazy-motion)`[
components](./react-lazy-motion), you can bring this down significantly, to
just under **6kb** for the initial render.

Then, with lazy-loading, you can defer the loading of animations and
interactions until after your site has rendered.

**Note:** All sizes quoted in this guide are from Rollup-generated bundles.
Webpack is less effective at tree-shaking and should generate slightly larger
bundles.

### Reduce size

Instead of importing `motion`, import the slimmer `m` component.

    
    
    import * as m from "motion/react-m"

`m` is used in the exact same way as `motion`, but unlike `motion`, the `m`
component doesn't come preloaded with features like animations, layout
animations, or the drag gesture.

Instead, we load these in manually via the `LazyMotion` component. This lets
you choose which features you load in, and whether you load them as part of
the main bundle, or lazy load them.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    
    // Load only the domAnimation package
    function App({ children }) {
      return (
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      )
    }

### Available features

There are currently two **feature packages** you can load:

  * `domAnimation`: This provides support for animations, variants, exit animations, and tap/hover/focus gestures. (**+15kb**)

  * `domMax`: This provides support for all of the above, plus pan/drag gestures and layout animations. (**+25kb**)

In the future it might be possible to offer more granular feature packages,
but for now these were chosen to reduce the amount of duplication between
features, which could result in much more data being downloaded ultimately.

### Synchronous loading

By passing one of these feature packages to `LazyMotion`, they'll be bundled
into your main JavaScript bundle.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    
    function App({ children }) {
      return (
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      )
    }

### Lazy loading

If you're using a bundler like Webpack or Rollup, we can pass a dynamic import
function to `features` that will fetch features only after we've performed our
initial render.

First, create a file that exports only the features you want to load.

    
    
    // features.js
    import { domMax } from "motion/react"
    export default domMax

Then, pass `features` a function that will dynamically load that file.

    
    
    import { LazyMotion } from "motion/react"
    import * as m from "motion/react-m"
    
    // Make sure to return the specific export containing the feature bundle.
    const loadFeatures = () =>
      import("./features.js").then(res => res.default)
    
    // This animation will run when loadFeatures resolves.
    function App() {
      return (
        <LazyMotion features={loadFeatures}>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        </LazyMotion>
      )
    }

### Strict mode

Because the normal `motion` component still preloads all of its functionality,
including it anywhere will break the benefits of using `LazyMotion`.

To help prevent this, the `strict` prop can be set on `LazyMotion`. If a
`motion` component is loaded anywhere within, it will throw with a reminder to
render the `m` component instead.

    
    
    function App() {
      // This will throw!
      return (
        <LazyMotion strict>
          <motion.div />
        </LazyMotion>
      )
    }

A great web experience doesn't just look and move beautifully, it should load
quickly, too.

When measuring the gzipped and minified size of Motion for React using a
bundle analysis website like
[Bundlephobia](https://bundlephobia.com/package/framer-motion@7.2.0), you
might see big numbers like **50kb** or more!

This is misleading. Motion for React exports many functions, most of which you
won't import. JavaScript bundlers like [Rollup](https://rollupjs.org/) and
[Webpack](https://webpack.js.org/) are capable of "tree shaking", which means
that only the code you import is shipped to consumers.

You may only use a tiny, single hook from Motion for React, like
`useReducedMotion`. So in that case the size would be closer to **1kb**.

However, Motion for React's primary animation APIs are `useAnimate` and
`motion`. Most developers will choose to use at least one of these when using
Motion, so let's see how to make them as small as possible.

## `useAnimate`

`[useAnimate](./react-use-animate)` is Motion for React's animation function,
used for manually triggering and controlling animations.

It comes in two sizes, **mini** (2.3kb) and **hybrid** (17kb).

The mini version exclusively uses WAAPI for hardware accelerated animations,
whereas the hybrid function can also animate sequences, motion values,
independent transforms and a whole lot more.

At 2.3kb, `useAnimate` mini is the smallest animation library available for
React.

## `motion`

The `[motion](./react-motion-component)`[ component](./react-motion-component)
is Motion for React's most common animation API.

Because of its declarative, props-driven API, it's impossible for bundlers to
tree shake it any smaller than **34kb**.

However, by using [the ](./react-lazy-motion)`[m](./react-lazy-motion)`[ and
](./react-lazy-motion)`[LazyMotion](./react-lazy-motion)`[
components](./react-lazy-motion), you can bring this down significantly, to
just under **6kb** for the initial render.

Then, with lazy-loading, you can defer the loading of animations and
interactions until after your site has rendered.

**Note:** All sizes quoted in this guide are from Rollup-generated bundles.
Webpack is less effective at tree-shaking and should generate slightly larger
bundles.

### Reduce size

Instead of importing `motion`, import the slimmer `m` component.

    
    
    import * as m from "motion/react-m"

`m` is used in the exact same way as `motion`, but unlike `motion`, the `m`
component doesn't come preloaded with features like animations, layout
animations, or the drag gesture.

Instead, we load these in manually via the `LazyMotion` component. This lets
you choose which features you load in, and whether you load them as part of
the main bundle, or lazy load them.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    
    // Load only the domAnimation package
    function App({ children }) {
      return (
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      )
    }

### Available features

There are currently two **feature packages** you can load:

  * `domAnimation`: This provides support for animations, variants, exit animations, and tap/hover/focus gestures. (**+15kb**)

  * `domMax`: This provides support for all of the above, plus pan/drag gestures and layout animations. (**+25kb**)

In the future it might be possible to offer more granular feature packages,
but for now these were chosen to reduce the amount of duplication between
features, which could result in much more data being downloaded ultimately.

### Synchronous loading

By passing one of these feature packages to `LazyMotion`, they'll be bundled
into your main JavaScript bundle.

    
    
    import { LazyMotion, domAnimation } from "motion/react"
    
    function App({ children }) {
      return (
        <LazyMotion features={domAnimation}>
          {children}
        </LazyMotion>
      )
    }

### Lazy loading

If you're using a bundler like Webpack or Rollup, we can pass a dynamic import
function to `features` that will fetch features only after we've performed our
initial render.

First, create a file that exports only the features you want to load.

    
    
    // features.js
    import { domMax } from "motion/react"
    export default domMax

Then, pass `features` a function that will dynamically load that file.

    
    
    import { LazyMotion } from "motion/react"
    import * as m from "motion/react-m"
    
    // Make sure to return the specific export containing the feature bundle.
    const loadFeatures = () =>
      import("./features.js").then(res => res.default)
    
    // This animation will run when loadFeatures resolves.
    function App() {
      return (
        <LazyMotion features={loadFeatures}>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        </LazyMotion>
      )
    }

### Strict mode

Because the normal `motion` component still preloads all of its functionality,
including it anywhere will break the benefits of using `LazyMotion`.

To help prevent this, the `strict` prop can be set on `LazyMotion`. If a
`motion` component is loaded anywhere within, it will throw with a reminder to
render the `m` component instead.

    
    
    function App() {
      // This will throw!
      return (
        <LazyMotion strict>
          <motion.div />
        </LazyMotion>
      )
    }

[Accessibility](./react-accessibility)

[Framer](./framer)

