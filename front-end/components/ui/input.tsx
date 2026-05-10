import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl bg-bg-elev px-4 text-sm",
        "border border-line placeholder:text-text-dim",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:border-brand/60",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-xl bg-bg-elev px-4 py-3 text-sm",
      "border border-line placeholder:text-text-dim",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:border-brand/60",
      "transition-colors disabled:cursor-not-allowed disabled:opacity-50 resize-none",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Label = ({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("text-xs font-medium text-text-muted uppercase tracking-wider", className)}
    {...props}
  />
);
