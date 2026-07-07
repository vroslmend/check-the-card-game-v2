import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** The brand mark is the game's own material: a miniature accent card back,
 *  tilted like a card just placed on the table. Size it via className
 *  (height; width follows the 5:7 card aspect). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex aspect-[5/7] h-9 -rotate-6 items-center justify-center rounded-[5px] bg-accent shadow-sm",
        className,
      )}
    >
      <Check
        className="h-[38%] w-[38%] text-accent-ink"
        strokeWidth={3}
      />
    </span>
  );
}
