import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ActionButton from "./ActionButton";
import Magnetic from "@/components/ui/Magnetic";
import { useActionController } from "./ActionController";

export interface Action {
  label: string;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  isProgressButton?: boolean;
  progressPercent?: number;
  remainingMs?: number;
  progressFillClassName?: string;
  isCircularProgress?: boolean;
  progressLabelClassName?: string;
}

const ActionBarComponent: React.FC = () => {
  const { getActions, getPromptText } = useActionController();
  const actions = getActions();
  const promptText = getPromptText();

  return (
    <motion.div
      className="flex flex-col items-center w-full"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        y: { type: "spring", stiffness: 400, damping: 28 },
        opacity: { duration: 0.2 },
      }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className="flex flex-row items-center justify-center flex-wrap gap-2 p-2 bg-black/20 backdrop-blur-xl rounded-full shadow-lg ring-1 ring-inset ring-white/10"
      >
        {actions.map((action, i) => (
          <Magnetic key={action.label || i} strength={20}>
            <ActionButton action={action} />
          </Magnetic>
        ))}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {promptText && (
          <motion.div
            layout
            key="prompt-text"
            className="mt-2 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100 px-3 py-1 bg-black/10 dark:bg-white/10 rounded-full">
              {promptText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ActionBarComponent;
