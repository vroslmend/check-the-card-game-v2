# Motion for React Three Fiber

Source: https://motion.dev/docs/react-three-fiber

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

# Motion for React Three Fiber

Deprecated

Deprecated

Motion for React Three Fiber is a simple yet powerful 3D animation library. It
offers most of the same functionality as Motion for React, but for declarative
3D scenes.

This guide will help you create animations with Motion for React Three Fiber,
but assumes you know the basics of both [Motion for React](./react-quick-
start) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-
started/introduction).

## Install

Motion for React Three Fiber is built upon the
[Three.js](https://threejs.org/) and [React Three
Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
(R3F) libraries. Install all three from npm:

    
    
    npm install three@0.137.0 @react-three/fiber@8.2.2 framer-motion-3d@11.2.0

**Warning:** Motion for React Three Fiber is currently only compatible with
React 18.

## Usage

### `motion` components

For every R3F component, there's a `motion` equivalent. Import `motion` from
`"framer-motion-3d"`:

    
    
    import { motion } from "framer-motion-3d"

And use in place of your R3F components:

    
    
    <motion.pointLight animate={{ x: 2 }} />

### Animation

Motion for R3F supports all the same [animation](./react-motion-component)
options as usual, including the `initial` and `animate` props, `exit` and
variants.

    
    
    const variants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    }
    
    return (
      <motion.meshStandardMaterial
        initial="hidden"
        animate="visible"
        variants={variants}
      />
    )

Currently, variants can't be automatically passed between the DOM and 3D
worlds, but you can still share state to achieve similar results:

    
    
    // index.js
    import { motion } from "framer-motion"
    import { Scene } from "./scene"
    
    export function App() {
      const [isHovered, setIsHovered] = useState(false)
      
      return (
        <motion.div
          whileHover={{ scale: 1.2 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(true)}
        >
          <Scene isHovered={isHovered} />
        </motion.div>
      )
    }
    
    // scene.js
    import { Canvas } from "@react-three/fiber"
    import { motion } from "framer-motion-3d"
    
    export function Scene({ isHovered }) {
      return (
        <Canvas>
          <motion.group animate={isHovered ? "hover" : "rest"}>
            <motion.mesh variants={{ hover: { z: 1 } }} />
          </motion.group>
        </Canvas>
      )
    }

### Supported values

3D `motion` components support most of the the same transforms as their 2D
equivalents:

  * `x`, `y` and `z`

  * `scale`, `scaleX`, `scaleY` and `scaleZ`

  * `rotateX`, `rotateY` and `rotateZ`

Additionally, `color` and `opacity` are supported on 3D primitives that
support them, like `meshStandardMaterial`, with support for more values coming
in the near future.

### Gestures

3D `motion` components support the hover and tap [gestures](./react-gestures)
on R3F with a physical presence (like `mesh`).

    
    
    <motion.mesh
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onHoverStart={() => console.log('hover start')}
      onTap={() => console.log('tapped!')}
    />

### Motion values

Motion values are used to track the state and velocity of animating values,
outside of React's render lifecycle.

With 3D `motion` components, motion values are injected via their R3F
attribute:

    
    
    import { useMotionValue, useTransform } from "framer-motion"
    import { motion } from "framer-motion-3d"
    
    export function Box() {
      const x = useMotionValue(0)
      const scaleZ = useTransform(x, v => v / 100)
      
      return (
        <motion.mesh
          position-x={x}
          scale={[1, 1, scaleZ]}
          animate={{ x: 100 }} 
        />
      )
    }

### Layout animations

Images, and therefore 3D scenes, involved in layout animations can exhibit
scale distortion. With the[ ](./react-three-fiber-layout-
cameras)`[LayoutCamera](./react-three-fiber-layout-cameras)`[ and ](./react-
three-fiber-layout-cameras)`[LayoutOrthographicCamera](./react-three-fiber-
layout-cameras)`[ components ](./react-three-fiber-layout-cameras)this
distortion can be corrected and the 3D scene can be incorporated into the
layout animation naturally.

Motion for React Three Fiber is a simple yet powerful 3D animation library. It
offers most of the same functionality as Motion for React, but for declarative
3D scenes.

This guide will help you create animations with Motion for React Three Fiber,
but assumes you know the basics of both [Motion for React](./react-quick-
start) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-
started/introduction).

## Install

Motion for React Three Fiber is built upon the
[Three.js](https://threejs.org/) and [React Three
Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
(R3F) libraries. Install all three from npm:

    
    
    npm install three@0.137.0 @react-three/fiber@8.2.2 framer-motion-3d@11.2.0

**Warning:** Motion for React Three Fiber is currently only compatible with
React 18.

## Usage

### `motion` components

For every R3F component, there's a `motion` equivalent. Import `motion` from
`"framer-motion-3d"`:

    
    
    import { motion } from "framer-motion-3d"

And use in place of your R3F components:

    
    
    <motion.pointLight animate={{ x: 2 }} />

### Animation

Motion for R3F supports all the same [animation](./react-motion-component)
options as usual, including the `initial` and `animate` props, `exit` and
variants.

    
    
    const variants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    }
    
    return (
      <motion.meshStandardMaterial
        initial="hidden"
        animate="visible"
        variants={variants}
      />
    )

Currently, variants can't be automatically passed between the DOM and 3D
worlds, but you can still share state to achieve similar results:

    
    
    // index.js
    import { motion } from "framer-motion"
    import { Scene } from "./scene"
    
    export function App() {
      const [isHovered, setIsHovered] = useState(false)
      
      return (
        <motion.div
          whileHover={{ scale: 1.2 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(true)}
        >
          <Scene isHovered={isHovered} />
        </motion.div>
      )
    }
    
    // scene.js
    import { Canvas } from "@react-three/fiber"
    import { motion } from "framer-motion-3d"
    
    export function Scene({ isHovered }) {
      return (
        <Canvas>
          <motion.group animate={isHovered ? "hover" : "rest"}>
            <motion.mesh variants={{ hover: { z: 1 } }} />
          </motion.group>
        </Canvas>
      )
    }

### Supported values

3D `motion` components support most of the the same transforms as their 2D
equivalents:

  * `x`, `y` and `z`

  * `scale`, `scaleX`, `scaleY` and `scaleZ`

  * `rotateX`, `rotateY` and `rotateZ`

Additionally, `color` and `opacity` are supported on 3D primitives that
support them, like `meshStandardMaterial`, with support for more values coming
in the near future.

### Gestures

3D `motion` components support the hover and tap [gestures](./react-gestures)
on R3F with a physical presence (like `mesh`).

    
    
    <motion.mesh
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onHoverStart={() => console.log('hover start')}
      onTap={() => console.log('tapped!')}
    />

### Motion values

Motion values are used to track the state and velocity of animating values,
outside of React's render lifecycle.

With 3D `motion` components, motion values are injected via their R3F
attribute:

    
    
    import { useMotionValue, useTransform } from "framer-motion"
    import { motion } from "framer-motion-3d"
    
    export function Box() {
      const x = useMotionValue(0)
      const scaleZ = useTransform(x, v => v / 100)
      
      return (
        <motion.mesh
          position-x={x}
          scale={[1, 1, scaleZ]}
          animate={{ x: 100 }} 
        />
      )
    }

### Layout animations

Images, and therefore 3D scenes, involved in layout animations can exhibit
scale distortion. With the[ ](./react-three-fiber-layout-
cameras)`[LayoutCamera](./react-three-fiber-layout-cameras)`[ and ](./react-
three-fiber-layout-cameras)`[LayoutOrthographicCamera](./react-three-fiber-
layout-cameras)`[ components ](./react-three-fiber-layout-cameras)this
distortion can be corrected and the 3D scene can be incorporated into the
layout animation naturally.

Motion for React Three Fiber is a simple yet powerful 3D animation library. It
offers most of the same functionality as Motion for React, but for declarative
3D scenes.

This guide will help you create animations with Motion for React Three Fiber,
but assumes you know the basics of both [Motion for React](./react-quick-
start) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-
started/introduction).

## Install

Motion for React Three Fiber is built upon the
[Three.js](https://threejs.org/) and [React Three
Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
(R3F) libraries. Install all three from npm:

    
    
    npm install three@0.137.0 @react-three/fiber@8.2.2 framer-motion-3d@11.2.0

**Warning:** Motion for React Three Fiber is currently only compatible with
React 18.

## Usage

### `motion` components

For every R3F component, there's a `motion` equivalent. Import `motion` from
`"framer-motion-3d"`:

    
    
    import { motion } from "framer-motion-3d"

And use in place of your R3F components:

    
    
    <motion.pointLight animate={{ x: 2 }} />

### Animation

Motion for R3F supports all the same [animation](./react-motion-component)
options as usual, including the `initial` and `animate` props, `exit` and
variants.

    
    
    const variants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    }
    
    return (
      <motion.meshStandardMaterial
        initial="hidden"
        animate="visible"
        variants={variants}
      />
    )

Currently, variants can't be automatically passed between the DOM and 3D
worlds, but you can still share state to achieve similar results:

    
    
    // index.js
    import { motion } from "framer-motion"
    import { Scene } from "./scene"
    
    export function App() {
      const [isHovered, setIsHovered] = useState(false)
      
      return (
        <motion.div
          whileHover={{ scale: 1.2 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(true)}
        >
          <Scene isHovered={isHovered} />
        </motion.div>
      )
    }
    
    // scene.js
    import { Canvas } from "@react-three/fiber"
    import { motion } from "framer-motion-3d"
    
    export function Scene({ isHovered }) {
      return (
        <Canvas>
          <motion.group animate={isHovered ? "hover" : "rest"}>
            <motion.mesh variants={{ hover: { z: 1 } }} />
          </motion.group>
        </Canvas>
      )
    }

### Supported values

3D `motion` components support most of the the same transforms as their 2D
equivalents:

  * `x`, `y` and `z`

  * `scale`, `scaleX`, `scaleY` and `scaleZ`

  * `rotateX`, `rotateY` and `rotateZ`

Additionally, `color` and `opacity` are supported on 3D primitives that
support them, like `meshStandardMaterial`, with support for more values coming
in the near future.

### Gestures

3D `motion` components support the hover and tap [gestures](./react-gestures)
on R3F with a physical presence (like `mesh`).

    
    
    <motion.mesh
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onHoverStart={() => console.log('hover start')}
      onTap={() => console.log('tapped!')}
    />

### Motion values

Motion values are used to track the state and velocity of animating values,
outside of React's render lifecycle.

With 3D `motion` components, motion values are injected via their R3F
attribute:

    
    
    import { useMotionValue, useTransform } from "framer-motion"
    import { motion } from "framer-motion-3d"
    
    export function Box() {
      const x = useMotionValue(0)
      const scaleZ = useTransform(x, v => v / 100)
      
      return (
        <motion.mesh
          position-x={x}
          scale={[1, 1, scaleZ]}
          animate={{ x: 100 }} 
        />
      )
    }

### Layout animations

Images, and therefore 3D scenes, involved in layout animations can exhibit
scale distortion. With the[ ](./react-three-fiber-layout-
cameras)`[LayoutCamera](./react-three-fiber-layout-cameras)`[ and ](./react-
three-fiber-layout-cameras)`[LayoutOrthographicCamera](./react-three-fiber-
layout-cameras)`[ components ](./react-three-fiber-layout-cameras)this
distortion can be corrected and the 3D scene can be incorporated into the
layout animation naturally.

[useVelocity](./react-use-velocity)

[Layout cameras](./react-three-fiber-layout-cameras)

