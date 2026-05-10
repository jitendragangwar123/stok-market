"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white hover:bg-brand-hover shadow-[0_8px_24px_rgba(124,92,255,0.4)]",
        secondary: "bg-bg-elev text-text border border-line hover:bg-bg-hover",
        ghost: "bg-transparent text-text-muted hover:bg-bg-elev hover:text-text",
        outline: "border border-line text-text hover:bg-bg-elev",
        yes: "bg-yes/15 text-yes border border-yes/40 hover:bg-yes/25",
        no: "bg-no/15 text-no border border-no/40 hover:bg-no/25",
        danger: "bg-no text-white hover:bg-no/90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
