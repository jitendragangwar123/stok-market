"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Activity, TrendingUp } from "lucide-react";
import type { MarketTrade } from "@/hooks/use-market-history";
import { cn } from "@/lib/utils";

const TIMEFRAMES = [
  { id: "1h", label: "1H", seconds: 3_600 },
  { id: "1d", label: "1D", seconds: 86_400 },
  { id: "7d", label: "7D", seconds: 7 * 86_400 },
  { id: "all", label: "All", seconds: Number.POSITIVE_INFINITY },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["id"];

export function ProbabilityChart({
  data,
  isLoading,
  currentYesPct,
}: {
  data: MarketTrade[];
  isLoading?: boolean;
  currentYesPct: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("all");

  // Mount the chart once; refresh data via setData on update.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9CA1AE",
        fontFamily:
          "var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(37, 40, 54, 0.6)", style: LineStyle.Dotted },
        horzLines: { color: "rgba(37, 40, 54, 0.6)", style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: "transparent",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "transparent",
        timeVisible: true,
        secondsVisible: false,
        // lightweight-charts renders Unix timestamps as UTC. Override the tick labels
        // so they show the viewer's local time instead.
        tickMarkFormatter: (time: number, tickMarkType: number, locale: string) => {
          const date = new Date((time as number) * 1000);
          switch (tickMarkType) {
            case TickMarkType.Year:
              return date.toLocaleDateString(locale, { year: "numeric" });
            case TickMarkType.Month:
              return date.toLocaleDateString(locale, { month: "short" });
            case TickMarkType.DayOfMonth:
              return date.toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              });
            case TickMarkType.Time:
            case TickMarkType.TimeWithSeconds:
            default:
              return date.toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
              });
          }
        },
      },
      localization: {
        // Crosshair tooltip — full local date + time.
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "#7C5CFF", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "#7C5CFF", width: 1, style: LineStyle.Dashed },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#7C5CFF",
      topColor: "rgba(124, 92, 255, 0.35)",
      bottomColor: "rgba(124, 92, 255, 0.0)",
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (v: number) => `${v.toFixed(1)}%`, minMove: 0.1 },
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerBorderColor: "#7C5CFF",
      crosshairMarkerBackgroundColor: "#0B0D14",
    });
    series.priceScale().applyOptions({ autoScale: false, mode: 0 });
    // Fix axis to 0..100 % so the line doesn't auto-stretch around a 50% plateau.
    series.applyOptions({
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push new points whenever the series updates or the timeframe changes.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const now = Math.floor(Date.now() / 1000);
    const tf = TIMEFRAMES.find((t) => t.id === timeframe)!;
    const cutoff =
      tf.seconds === Number.POSITIVE_INFINITY ? Number.NEGATIVE_INFINITY : now - tf.seconds;
    const filtered = data.filter((p) => p.time >= cutoff);

    if (filtered.length === 0) {
      // Synthetic flatline at the current probability so the chart isn't blank.
      // Span the selected timeframe so the empty window is visually obvious.
      const startTime =
        tf.seconds === Number.POSITIVE_INFINITY ? now - 60 : now - tf.seconds;
      series.setData([
        { time: startTime as UTCTimestamp, value: currentYesPct },
        { time: now as UTCTimestamp, value: currentYesPct },
      ]);
    } else {
      // When the user picks a narrow window, prepend a synthetic anchor so the
      // line starts at the carry-over value rather than the first in-window bet
      // — otherwise the visible series jumps abruptly from the axis.
      const points = filtered.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      }));
      if (tf.seconds !== Number.POSITIVE_INFINITY && filtered[0].time > cutoff) {
        const carryValue = lastBefore(data, cutoff) ?? filtered[0].value;
        points.unshift({ time: cutoff as UTCTimestamp, value: carryValue });
      }
      series.setData(points);
    }
    chart.timeScale().fitContent();
  }, [data, currentYesPct, timeframe]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            YES probability
          </CardTitle>
          <p className="mt-1 text-xs text-text-muted">
            Implied odds from on-chain pool ratios. Each point is the probability after a
            bet settled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-elev/60 px-2 py-1 text-xs">
            <TrendingUp className="h-3 w-3 text-yes" />
            <span className="font-mono">{currentYesPct.toFixed(1)}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {isLoading && data.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/40 backdrop-blur-sm">
              <Skeleton className="h-32 w-3/4" />
            </div>
          )}
          <div ref={containerRef} className="h-72 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function TimeframeSelector({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (v: Timeframe) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Chart timeframe"
      className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-bg-card/60 p-0.5 text-xs"
    >
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.id}
          type="button"
          role="tab"
          aria-selected={value === tf.id}
          onClick={() => onChange(tf.id)}
          className={cn(
            "rounded-md px-2 py-0.5 font-medium transition-colors",
            value === tf.id
              ? "bg-bg-elev text-text"
              : "text-text-muted hover:text-text"
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}

/** Last value before (or at) `cutoff` in a time-sorted series, or null. */
function lastBefore(data: MarketTrade[], cutoff: number): number | null {
  let last: number | null = null;
  for (const p of data) {
    if (p.time <= cutoff) last = p.value;
    else break;
  }
  return last;
}
