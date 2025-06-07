'use client';

import { useRef, useState } from 'react'
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export default function Magnetic({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({x:0,y:0});

    const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
        const { clientX, clientY } = e;
        if (ref.current) {
            const {height, width, left, top} = ref.current.getBoundingClientRect();
            const middleX = (clientX - (left + width/2)) * 0.125
            const middleY = (clientY - (top + height/2)) * 0.125
            setPosition({x: middleX, y: middleY})
        }
    }

    const reset = () => {
        setPosition({x:0, y:0})
    }

    const { x, y } = position;
    return (
        <motion.div
            style={{position: "relative"}}
            ref={ref}
            onMouseMove={handleMouse}
            onMouseLeave={reset}
            animate={{x, y}}
            transition={{type: "spring", stiffness: 250, damping: 20, mass: 0.5}}
        >
            {children}
        </motion.div>
    )
} 