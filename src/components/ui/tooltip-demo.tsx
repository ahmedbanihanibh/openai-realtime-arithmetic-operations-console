import React, { ReactNode } from 'react';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define the props interface
interface TooltipDemoProps {
  children: ReactNode; // Type for children
  tooltipText?: string; // Optional tooltip text
}

export function TooltipDemo({ children, tooltipText = "Add to library" }: TooltipDemoProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}