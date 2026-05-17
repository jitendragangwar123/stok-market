"use client";

import { useEffect, useRef } from "react";
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

  // Push new points whenever the series updates.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (data.length === 0) {
      // Synthetic flatline at the current probability so the chart isn't blank.
      const now = Math.floor(Date.now() / 1000);
      series.setData([
        { time: (now - 60) as UTCTimestamp, value: currentYesPct },
        { time: now as UTCTimestamp, value: currentYesPct },
      ]);
    } else {
      series.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
      );
    }
    chart.timeScale().fitContent();
  }, [data, currentYesPct]);

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
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-elev/60 px-2 py-1 text-xs">
          <TrendingUp className="h-3 w-3 text-yes" />
          <span className="font-mono">{currentYesPct.toFixed(1)}%</span>
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
