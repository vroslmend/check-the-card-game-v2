"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { spline } from "@georgedoescode/spline"
import { createNoise2D } from "simplex-noise"

const blobStyles = {
  width: "100%",
  height: "100%",
}

export function AnimatedBlob() {
  const pathRef = useRef<SVGPathElement>(null)
  
  useEffect(() => {
    const noise2D = createNoise2D();
    const root = document.documentElement
    let hueNoiseOffset = 0
    let noiseStep = 0.002

    const createPoints = () => {
      const points = []
      const numPoints = 6
      const angleStep = (Math.PI * 2) / numPoints
      const rad = 90

      for (let i = 1; i <= numPoints; i++) {
        const theta = i * angleStep
        const x = 100 + Math.cos(theta) * rad
        const y = 100 + Math.sin(theta) * rad
        points.push({
          x: x,
          y: y,
          originX: x,
          originY: y,
          noiseOffsetX: Math.random() * 1000,
          noiseOffsetY: Math.random() * 1000,
        })
      }
      return points
    }

    const map = (n: number, start1: number, end1: number, start2: number, end2: number) => {
      return ((n - start1) / (end1 - start1)) * (end2 - start2) + start2
    }
    
    const noise = (x: number, y: number) => {
      return noise2D(x, y)
    }

    const points = createPoints()
    let animationFrameId: number;

    const animate = () => {
      if (pathRef.current) {
        pathRef.current.setAttribute("d", spline(points, 1, true))
      }

      for (let i = 0; i < points.length; i++) {
        const point = points[i]
        const nX = noise(point.noiseOffsetX, point.noiseOffsetX)
        const nY = noise(point.noiseOffsetY, point.noiseOffsetY)
        const x = map(nX, -1, 1, point.originX - 20, point.originX + 20)
        const y = map(nY, -1, 1, point.originY - 20, point.originY + 20)
        point.x = x
        point.y = y
        point.noiseOffsetX += noiseStep
        point.noiseOffsetY += noiseStep
      }
      
      const hueNoise = noise(hueNoiseOffset, hueNoiseOffset)
      const hue = map(hueNoise, -1, 1, 220, 280)

      root.style.setProperty("--startColor", `hsl(${hue}, 80%, 85%)`)
      root.style.setProperty("--stopColor", `hsl(${hue + 60}, 80%, 90%)`)
      
      hueNoiseOffset += noiseStep / 2;

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <motion.svg
      viewBox="-50 -50 300 300"
      style={blobStyles}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      transition={{
        opacity: { duration: 0.4, ease: "easeOut" },
      }}
    >
      <defs>
        <linearGradient id="blob-gradient" gradientTransform="rotate(90)">
          <stop id="gradientStop1" offset="0%" stopColor="var(--startColor)" />
          <stop id="gradientStop2" offset="100%" stopColor="var(--stopColor)" />
        </linearGradient>
        <filter id="blob-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
        </filter>
      </defs>
      <path ref={pathRef} fill="url(#blob-gradient)" filter="url(#blob-blur)"></path>
    </motion.svg>
  )
} 