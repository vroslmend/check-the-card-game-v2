import { useState, useEffect, useRef } from "react"
import { useScroll, useSpring, useTransform } from "framer-motion"

export function useScrollHijack(subsectionCount: number) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [sectionHeight, setSectionHeight] = useState(0)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  useEffect(() => {
    const unsubscribe = smoothProgress.on("change", (value) => {
      if (value < 0 || value > 1) return

      const sectionSize = 1 / subsectionCount
      const newIndex = Math.min(Math.floor(value / sectionSize), subsectionCount - 1)
      setActiveIndex(newIndex)
    })

    return () => unsubscribe()
  }, [smoothProgress, subsectionCount])

  useEffect(() => {
    const handleResize = () => {
      setSectionHeight(window.innerHeight * subsectionCount)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [subsectionCount])

  // Custom progress per-feature
  const featureProgresses = Array.from({ length: subsectionCount }).map((_, i) => {
    const segmentLength = 1 / subsectionCount
    return useSpring(
      useTransform(smoothProgress, [i * segmentLength, (i + 1) * segmentLength], [0, 1]),
      { stiffness: 100, damping: 30 }
    )
  })

  return {
    sectionRef,
    activeIndex,
    sectionHeight,
    scrollProgress: smoothProgress,
    featureProgresses,
  }
} 