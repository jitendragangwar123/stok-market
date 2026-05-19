"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string> = {
  id: T;
  label: string;
};

/**
 * Theme-matched custom dropdown. Generic over the id type so callers keep
 * full type-safety on `value` / `onChange`. Closes on outside click and on
 * the Escape key.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  align = "right",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly SelectOption<T>[];
  label?: string;
  /** Which edge of the trigger the menu aligns to. Defaults to "right". */
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.id === value);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border bg-bg-card/60 px-3 py-2 text-xs font-medium text-text",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
          open ? "border-brand/40 bg-bg-elev/70" : "border-line hover:border-brand/40 hover:bg-bg-elev/70"
        )}
      >
        {label && <span className="text-text-muted">{label}</span>}
        <span>{selected?.label ?? "—"}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-text-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-xl border border-line bg-bg-card/95 shadow-card backdrop-blur-md animate-in",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((o) => {
            const isSelected = o.id === value;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors",
                  isSelected
                    ? "bg-brand/10 text-brand"
                    : "text-text hover:bg-bg-elev"
                )}
              >
                <span>{o.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
