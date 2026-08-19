import type { ReactElement } from "react";
import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

/**
 * Thin convenience wrapper over shadcn/ui's tooltip: pass a `label` and the
 * control to trigger it. `side` maps to Radix's placement — left for the
 * vertical rail (buttons point inward), bottom for the horizontal toolbar.
 */
export function Tooltip({
  label,
  side = "left",
  children,
}: {
  label: string;
  side?: "left" | "bottom";
  children: ReactElement;
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipRoot>
  );
}
