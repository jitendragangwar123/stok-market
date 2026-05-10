import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-tight",
  {
    variants: {
      variant: {
        default: "bg-bg-elev text-text-muted border border-line",
        active: "bg-brand/15 text-brand border border-brand/30",
        resolved: "bg-yes/15 text-yes border border-yes/30",
        cancelled: "bg-text-dim/10 text-text-muted border border-line",
        yes: "bg-yes/15 text-yes border border-yes/30",
        no: "bg-no/15 text-no border border-no/30",
        warn: "bg-warn/15 text-warn border border-warn/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}
