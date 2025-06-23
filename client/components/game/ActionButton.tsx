import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Action } from "./ActionBarComponent";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActionButtonProps {
  action: Action;
}

const ActionButton: React.FC<ActionButtonProps> = ({ action }) => {
  const {
    label,
    onClick,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    disabled = false,
    icon,
    className = "",
    isLoading = false,
    isProgressButton = false,
    progressPercent = 0,
    progressFillClassName = "bg-sky-500/50",
  } = action;

  const buttonContent = (
    <>
      {icon ? (
        // Primary case: Icon is present
        <span className="relative z-20">{icon}</span>
      ) : (
        // Fallback case: No icon, show label on button
        <span className="relative z-20 text-xs font-semibold px-2">
          {label}
        </span>
      )}

      {isLoading && <Loader2 className="absolute h-4 w-4 animate-spin z-10" />}

      {isProgressButton && progressPercent > 0 && (
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full",
            progressFillClassName,
            "z-10",
          )}
          initial={{ width: "0%" }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
          style={{ transformOrigin: "left" }}
        />
      )}
    </>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileHover={{ scale: disabled ? 1 : 1.1 }}
            whileTap={{ scale: disabled ? 1 : 0.9 }}
            className={cn(
              "relative h-10 shrink-0 rounded-full flex items-center justify-center",
              // If there's an icon, it's a circle. If not, it's a pill with padding.
              icon ? "w-10" : "px-4",
              "bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black/10 dark:disabled:hover:bg-white/10",
              "transition-colors",
              isLoading && "cursor-wait",
              className,
            )}
            disabled={disabled || isLoading}
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {buttonContent}
          </motion.button>
        </TooltipTrigger>
        {/* Only show tooltip if there's an icon to hide the label for */}
        {icon && (
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

export default ActionButton;
