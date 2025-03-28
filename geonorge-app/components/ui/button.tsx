import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        standard:
          "flex min-w-[140px] items-center justify-center gap-1 rounded-omar border bg-white px-3 py-1.5 text-sm shadow-sm transition-all hover:bg-gray-100",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm rounded-omar hover:bg-accent hover:text-accent-foreground",
        continue:
          "flex min-w-[140px] items-center justify-center gap-1 rounded-omar border bg-white px-3 py-1.5 text-sm text-color-kv-secondary shadow-sm transition-all hover:bg-gray-100",
        download:
          "flex min-w-[140px] items-center justify-center gap-1 rounded-omar border bg-white px-3 py-1.5 text-sm shadow-sm transition-all hover:bg-gray-100",
        show: "flex min-w-[140px] items-center justify-center gap-1 rounded-omar border bg-white px-3 py-1.5 text-sm text-color-kv-primary shadow-sm transition-all hover:bg-gray-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
