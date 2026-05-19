"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMarkets } from "@/hooks/use-markets";
import { MarketCard } from "@/components/market-card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketState } from "@/lib/contracts";
import { CATEGORIES, categorize, isCategory, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const STATE_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
  { id: "cancelled", label: "Cancelled" },
] as const;
type StateFilter = (typeof STATE_FILTERS)[number]["id"];

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "ending", label: "Ending soon" },
  { id: "trending", label: "Trending" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

type CategoryFilter = Category | "all";

/**
 * useSearchParams() forces this page off Next.js's static prerender path
 * unless we wrap the consuming component in a Suspense boundary. The
 * top-level default export is just that boundary; all real logic lives in
 * MarketsContent below.
 */
export default function MarketsPage() {
  return (
    <Suspense fallback={<MarketsSkeleton />}>
      <MarketsContent />
    </Suspense>
  );
}

function MarketsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-56" />
      ))}
    </div>
  );
}

function MarketsContent() {
  const { markets, isLoading, count } = useMarkets();
  const searchParams = useSearchParams();
  const paramCategory = searchParams.get("category");

  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() =>
    isCategory(paramCategory) ? paramCategory : "all"
  );
  const [sort, setSort] = useState<SortId>("newest");
  const [query, setQuery] = useState("");

  // Keep the category filter in sync with the URL — navigating between
  // different /markets?category=X links from the hero shouldn't unmount the
  // page, so useState's initializer alone wouldn't update on subsequent visits.
  useEffect(() => {
    if (isCategory(paramCategory)) {
      setCategoryFilter(paramCategory);
    }
  }, [paramCategory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = markets.filter((m) => {
      // State filter
      if (stateFilter === "active" && m.state !== MarketState.Active) return false;
      if (stateFilter === "resolved" && m.state !== MarketState.Resolved) return false;
      if (stateFilter === "cancelled" && m.state !== MarketState.Cancelled) return false;
      // Search
      if (q && !m.question.toLowerCase().includes(q)) return false;
      // Category
      if (categoryFilter !== "all" && categorize(m.question) !== categoryFilter) return false;
      return true;
    });

    // Sort (stable copy)
    const sorted = [...out];
    if (sort === "newest") {
      sorted.sort((a, b) => Number(b.createdAt - a.createdAt));
    } else if (sort === "ending") {
      // Active first by resolutionTime ascending; finalized markets pushed to the end.
      sorted.sort((a, b) => {
        const aActive = a.state === MarketState.Active ? 0 : 1;
        const bActive = b.state === MarketState.Active ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return Number(a.resolutionTime - b.resolutionTime);
      });
    } else {
      // Trending: by total pool size desc.
      sorted.sort((a, b) => {
        const aTotal = a.yesPool + a.noPool;
        const bTotal = b.yesPool + b.noPool;
        return aTotal > bTotal ? -1 : aTotal < bTotal ? 1 : 0;
      });
    }
    return sorted;
  }, [markets, stateFilter, categoryFilter, sort, query]);

  return (
    <div className="space-y-6">
      <section id="markets" className="space-y-5 scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Markets</h1>
            <p className="mt-1 text-sm text-text-muted">
              Browse every YES/NO question on Stok Market. Filter, search, sort — then click in
              to take a side.
            </p>
          </div>
          <SortSelect value={sort} onChange={setSort} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search markets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* State filter */}
        <FilterPills
          label="State"
          options={STATE_FILTERS}
          value={stateFilter}
          onChange={setStateFilter}
        />

        {/* Category filter */}
        <FilterPills
          label="Category"
          options={[{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c, label: c }))]}
          value={categoryFilter}
          onChange={setCategoryFilter}
        />

        {isLoading && count > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={query.length > 0 || categoryFilter !== "all" || stateFilter !== "all"} />
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

function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-text-muted">{label}</span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-bg-card/60 p-1">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              value === o.id ? "bg-bg-elev text-text" : "text-text-muted hover:text-text"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortSelect({ value, onChange }: { value: SortId; onChange: (v: SortId) => void }) {
  return <Select label="Sort" value={value} onChange={onChange} options={SORTS} />;
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-16 text-center">
      <div className="text-sm text-text-muted">
        {hasQuery ? "No markets match your filters." : "No markets here yet."}
      </div>
      <p className="mt-1 max-w-sm text-xs text-text-dim">
        {hasQuery
          ? "Try clearing the search or switching the category filter."
          : "Be the first to ask the question — the next billion-dollar question might be yours."}
      </p>
    </div>
  );
}
