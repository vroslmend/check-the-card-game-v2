"use client"

import { useEffect, useRef } from "react"

interface FloatingCardsProps {
  mousePosition: { x: number; y: number }
}

export function FloatingCards({ mousePosition }: FloatingCardsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Card particles
    const cards: Card[] = []
    const numberOfCards = 15

    class Card {
      x: number
      y: number
      width: number
      height: number
      rotation: number
      rotationSpeed: number
      speedX: number
      speedY: number
      opacity: number

      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.width = 20 + Math.random() * 15
        this.height = this.width * 1.4
        this.rotation = Math.random() * Math.PI * 2
        this.rotationSpeed = (Math.random() - 0.5) * 0.02
        this.speedX = (Math.random() - 0.5) * 0.5
        this.speedY = (Math.random() - 0.5) * 0.5
        this.opacity = 0.1 + Math.random() * 0.1
      }

      update() {
        // Mouse interaction
        const mouseInfluence = 50
        const dx = this.x - (mousePosition.x * canvas.width * 0.5 + canvas.width * 0.5)
        const dy = this.y - (mousePosition.y * canvas.height * 0.5 + canvas.height * 0.5)
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < mouseInfluence) {
          const force = (mouseInfluence - distance) / mouseInfluence
          this.x += (dx / distance) * force * 2
          this.y += (dy / distance) * force * 2
        }

        this.x += this.speedX
        this.y += this.speedY
        this.rotation += this.rotationSpeed

        // Wrap around edges
        if (this.x > canvas.width + this.width) this.x = -this.width
        if (this.x < -this.width) this.x = canvas.width + this.width
        if (this.y > canvas.height + this.height) this.y = -this.height
        if (this.y < -this.height) this.y = canvas.height + this.height
      }

      draw() {
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.rotate(this.rotation)
        ctx.globalAlpha = this.opacity

        // Card background
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)"
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height)

        // Card border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"
        ctx.lineWidth = 1
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height)

        // Card corner radius effect
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)"
        ctx.beginPath()
        ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 3)
        ctx.fill()

        ctx.restore()
      }
    }

    // Initialize cards
    for (let i = 0; i < numberOfCards; i++) {
      cards.push(new Card())
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      cards.forEach((card) => {
        card.update()
        card.draw()
      })

      requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [mousePosition])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 opacity-60" />
}
