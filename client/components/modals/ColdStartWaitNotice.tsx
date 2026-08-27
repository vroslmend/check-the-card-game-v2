"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUISelector } from "@/context/GameUIContext";

// The live region is mounted whether or not there is anything to say. A screen
// reader only announces changes inside a region that was already present, so
// mounting it along with the text would announce nothing.
//
// The rule belongs to the second phase alone. It is the heavier treatment, and
// it earns its place only once the wait is long enough to need explaining.
export function ColdStartWaitNotice({ className }: { className?: string }) {
  const phase = useUISelector((s) => s.context.coldStartPhase);

  return (
    <div aria-live="polite" className={className}>
      <AnimatePresence initial={false}>
        {phase !== "silent" && (
          <motion.div
            key="notice"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.22, ease: "easeOut" },
            }}
            className="overflow-hidden"
          >
            <motion.div layout="position" className="pt-4">
              <AnimatePresence initial={false}>
                {phase === "explaining" && (
                  <motion.div
                    key="rule"
                    initial={{ opacity: 0, scaleX: 0.7 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
                    className="mb-3 h-px origin-left bg-hairline"
                  />
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={phase}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="text-xs leading-relaxed text-ink-muted"
                >
                  {phase === "explaining"
                    ? "The server sleeps when nobody is playing, so the first game takes about a minute."
                    : "The server is waking up."}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
