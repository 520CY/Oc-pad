import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            "h-9 w-full appearance-none rounded-lg border border-input/85 bg-gradient-to-b from-background to-muted/20 px-3 pr-9 text-sm shadow-sm transition-all duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-1 right-1.5 flex w-7 items-center justify-center rounded-md bg-muted/40">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
