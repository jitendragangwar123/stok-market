"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * Custom datetime picker. Theme-matched, no external deps.
 *
 * The popover is portaled to document.body and positioned with fixed
 * coordinates derived from the trigger's bounding rect. Without that, the
 * popover sits inside the surrounding <Card>, which uses backdrop-blur and
 * therefore establishes its own stacking context — z-50 on the popover gets
 * trapped and the next Card paints on top of it.
 */
export function DateTimePicker({
  value,
  onChange,
  min,
  className,
}: {
  value: Date;
  onChange: (d: Date) => void;
  min?: Date;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // External value changes (e.g. quick-duration buttons) should realign view.
  useEffect(() => {
    setViewYear(value.getFullYear());
    setViewMonth(value.getMonth());
  }, [value]);

  // Position the portaled popover under the trigger. Updates on open and on
  // window scroll/resize so it stays anchored.
  useLayoutEffect(() => {
    if (!open) return;
    const updateCoords = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  // Outside-click + Escape close. Trigger and popover are in different
  // subtrees thanks to the portal, so we check both refs.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = rootRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inTrigger && !inPopover) setOpen(false);
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

  // Build the 6-week (42-cell) grid for the visible month.
  const days = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const minDay = useMemo(() => (min ? startOfDay(min) : null), [min]);

  function selectDay(d: Date) {
    if (minDay && startOfDay(d) < minDay) return;
    const next = new Date(d);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(next);
  }

  function setTime(hours: number, minutes: number) {
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const next = new Date(value);
    next.setHours(clamp(hours, 0, 23), clamp(minutes, 0, 59), 0, 0);
    onChange(next);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const today = new Date();

  const popover = open && mounted && (
    <div
      ref={popoverRef}
      role="dialog"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width: Math.max(coords.width, 280),
      }}
      className="z-50 rounded-2xl border border-line bg-bg-card/95 p-4 shadow-card backdrop-blur-md animate-in"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <IconButton ariaLabel="Previous month" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <div className="text-sm font-medium tracking-tight">
          {new Date(viewYear, viewMonth).toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </div>
        <IconButton ariaLabel="Next month" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>

      {/* Weekday header row */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-text-dim">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map(({ date, inMonth }, i) => {
          const selected = isSameDay(date, value);
          const isToday = isSameDay(date, today);
          const disabled = !!minDay && startOfDay(date) < minDay;
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectDay(date)}
              disabled={disabled}
              className={cn(
                "h-9 rounded-lg text-xs transition-colors",
                selected
                  ? "bg-brand text-white"
                  : inMonth
                    ? "text-text hover:bg-bg-elev"
                    : "text-text-dim hover:bg-bg-elev/50",
                isToday && !selected && "ring-1 ring-brand/40",
                disabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Time row */}
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          Time
        </span>
        <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-elev px-2 py-1">
          <NumberInput
            value={value.getHours()}
            min={0}
            max={23}
            onChange={(h) => setTime(h, value.getMinutes())}
            ariaLabel="Hour"
          />
          <span className="text-text-muted">:</span>
          <NumberInput
            value={value.getMinutes()}
            min={0}
            max={59}
            onChange={(m) => setTime(value.getHours(), m)}
            ariaLabel="Minute"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-bg-elev px-4 text-sm text-text transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
          open ? "border-brand/60" : "border-line hover:border-brand/40"
        )}
      >
        <span className="inline-flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-text-muted" />
          <span>{formatLabel(value)}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {popover && createPortal(popover, document.body)}
    </div>
  );
}

function IconButton({
  onClick,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-elev hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      {children}
    </button>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      inputMode="numeric"
      pattern="[0-9]*"
      value={String(value).padStart(2, "0")}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        if (raw === "") return onChange(min);
        const n = parseInt(raw, 10);
        if (Number.isNaN(n)) return;
        onChange(clamp(n, min, max));
      }}
      className="w-7 bg-transparent text-center font-mono text-xs text-text outline-none"
    />
  );
}

/* ----------------------------- date helpers ----------------------------- */

function buildMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startDow = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const out: { date: Date; inMonth: boolean }[] = [];

  // Leading days from prev month.
  for (let i = startDow - 1; i >= 0; i--) {
    out.push({ date: new Date(year, month, -i), inMonth: false });
  }

  // Current month days.
  for (let d = 1; d <= daysInMonth; d++) {
    out.push({ date: new Date(year, month, d), inMonth: true });
  }

  // Trailing days from next month — fill to a flat 42 cells (6 rows).
  while (out.length < 42) {
    const last = out[out.length - 1].date;
    out.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inMonth: false,
    });
  }
  return out;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

// Locale-independent format. toLocaleString picks the server's vs the
// browser's locale and triggers a hydration mismatch on this client-rendered
// trigger button; this hand-rolled format avoids that.
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatLabel(d: Date): string {
  const month = MONTH_LABELS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${year} · ${h}:${m}`;
}
