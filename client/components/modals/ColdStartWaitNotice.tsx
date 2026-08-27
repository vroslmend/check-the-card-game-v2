"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUISelector } from "@/context/GameUIContext";

// The live region is mounted whether or not there is anything to say. A screen
// reader only announces changes inside a region that was already present, so
// mounting it along with the text would announce nothing.
export function ColdStartWaitNotice({ className }: { className?: string }) {
  const phase = useUISelector((s) => s.context.coldStartPhase);

  return (
    <div aria-live="polite" className={className}>
      <AnimatePresence mode="wait">
        {phase !== "silent" && (
          <motion.p
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="text-xs leading-relaxed text-ink-muted"
          >
            {phase === "explaining"
              ? "The server sleeps when nobody is playing. The first game after a quiet spell takes about a minute."
              : "The server is waking up."}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
