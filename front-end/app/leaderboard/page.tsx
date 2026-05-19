"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard, type LeaderboardEntry } from "@/hooks/use-leaderboard";
import { STABLECOIN_SYMBOL } from "@/lib/contracts";
import { formatToken, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Trophy, TrendingUp, Crown, Medal } from "lucide-react";

const TABS = [
  { id: "volume", label: "Top volume", icon: TrendingUp },
  { id: "winners", label: "Top winners", icon: Trophy },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function LeaderboardPage() {
  const { topVolume, topClaimed, isLoading, isIndexerEnabled } = useLeaderboard(25);
  const [tab, setTab] = useState<TabId>("volume");

  const rows = tab === "volume" ? topVolume : topClaimed;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Top traders by lifetime activity. Click a row for the full profile.
        </p>
      </header>

      {!isIndexerEnabled ? (
        <IndexerRequiredNotice />
      ) : (
        <>
          <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg-card/60 p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    tab === t.id ? "bg-bg-elev text-text" : "text-text-muted hover:text-text"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {isLoading && rows.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            <LeaderboardTable rows={rows} tab={tab} />
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardTable({ rows, tab }: { rows: LeaderboardEntry[]; tab: TabId }) {
  const metricLabel = tab === "volume" ? "Volume" : "Claimed";
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="px-4 py-2.5 font-medium">Rank</th>
              <th className="px-4 py-2.5 font-medium">Address</th>
              <th className="px-4 py-2.5 text-right font-medium">Bets</th>
              <th className="px-4 py-2.5 text-right font-medium">{metricLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <LeaderboardRow key={row.address} row={row} rank={i + 1} tab={tab} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function LeaderboardRow({
  row,
  rank,
  tab,
}: {
  row: LeaderboardEntry;
  rank: number;
  tab: TabId;
}) {
  const metric = tab === "volume" ? row.totalVolume : row.totalClaimed;

  return (
    <tr className="border-b border-line/60 last:border-0 transition-colors hover:bg-bg-elev/40">
      <td className="px-4 py-3 align-middle">
        <RankBadge rank={rank} />
      </td>
      <td className="px-4 py-3 align-middle">
        <Link
          href={`/u/${row.address}`}
          className="font-mono text-xs text-text transition-colors hover:text-brand"
        >
          {shortAddr(row.address)}
        </Link>
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <span className="font-mono text-xs text-text-muted">{row.totalBets}</span>
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <span className={cn("font-mono text-sm font-medium", tab === "winners" && "text-yes")}>
          {formatToken(metric)} {STABLECOIN_SYMBOL}
        </span>
      </td>
    </tr>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-warn/15 text-warn border border-warn/40">
        <Crown className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (rank <= 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-brand border border-brand/40">
        <Medal className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-elev text-text-muted text-xs font-mono">
      {rank}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-16 text-center">
      <div className="text-sm text-text-muted">No leaderboard data yet.</div>
      <p className="mt-1 max-w-sm text-xs text-text-dim">
        Once people start betting, ranks show up here.
      </p>
    </div>
  );
}

function IndexerRequiredNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <div className="space-y-1">
        <div className="font-medium text-text">Leaderboard requires the indexer.</div>
        <p className="text-text-muted">
          Rankings are computed from indexed event aggregates. Set{" "}
          <span className="font-mono">NEXT_PUBLIC_INDEXER_URL</span> to enable this page.
        </p>
      </div>
    </div>
  );
}
