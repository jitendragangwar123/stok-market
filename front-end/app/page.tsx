"use client";

import { useMemo, useState } from "react";
import { useMarkets } from "@/hooks/use-markets";
import { Hero } from "@/components/hero";
import { MarketCard } from "@/components/market-card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketState } from "@/lib/contracts";
import { formatTokenWithSymbol } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
  { id: "cancelled", label: "Cancelled" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

export default function HomePage() {
  const { markets, isLoading, count } = useMarkets();
  const [filter, setFilter] = useState<FilterId>("all");

  const totalLocked = useMemo(
    () =>
      markets
        .filter((m) => m.state === MarketState.Active)
        .reduce((sum, m) => sum + m.yesPool + m.noPool, 0n),
    [markets]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return markets;
    if (filter === "active") return markets.filter((m) => m.state === MarketState.Active);
    if (filter === "resolved") return markets.filter((m) => m.state === MarketState.Resolved);
    return markets.filter((m) => m.state === MarketState.Cancelled);
  }, [markets, filter]);

  return (
    <div className="space-y-10">
      <Hero totalMarkets={count} totalLocked={formatTokenWithSymbol(totalLocked)} />

      <section id="markets" className="space-y-5 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Markets</h2>
          <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg-card/60 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "bg-bg-elev text-text"
                    : "text-text-muted hover:text-text"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && count > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MarketCard key={m.id.toString()} market={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-16 text-center">
      <div className="text-sm text-text-muted">No markets here yet.</div>
      <p className="mt-1 max-w-sm text-xs text-text-dim">
        Be the first to ask the question — the next billion-dollar question might be yours.
      </p>
    </div>
  );
}
