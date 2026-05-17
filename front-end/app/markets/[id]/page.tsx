"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMarket } from "@/hooks/use-markets";
import { useMarketHistory } from "@/hooks/use-market-history";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown } from "@/components/countdown";
import { BetPanel } from "@/components/bet-panel";
import { PositionPanel } from "@/components/position-panel";
import { ProbabilityChart } from "@/components/probability-chart";
import { TradeHistory } from "@/components/trade-history";
import { MarketState, outcomeLabel, STABLECOIN_SYMBOL } from "@/lib/contracts";
import { formatDate, formatToken, pct, shortAddr } from "@/lib/format";
import { ArrowLeft, ChevronRight, ScrollText, User2 } from "lucide-react";

export default function MarketPage() {
  const { id } = useParams<{ id: string }>();
  const marketId = id ? BigInt(id) : undefined;
  const { data: market, isLoading } = useMarket(marketId);
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useMarketHistory(marketId, market?.createdAt);

  if (isLoading || !market) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const total = market.yesPool + market.noPool;
  const yesPct = pct(market.yesPool, total);
  const stateBadge = market.state === MarketState.Active
    ? { label: "Active", variant: "active" as const }
    : market.state === MarketState.Resolved
    ? { label: `Resolved · ${outcomeLabel[market.winningOutcome]}`, variant: "resolved" as const }
    : { label: "Cancelled", variant: "cancelled" as const };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-text-muted">
        <Link href="/markets" className="inline-flex items-center gap-1 hover:text-text">
          <ArrowLeft className="h-3.5 w-3.5" />
          Markets
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text">#{market.id.toString()}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start justify-between gap-3">
                <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
                {market.state === MarketState.Active ? (
                  <Countdown resolutionTime={market.resolutionTime} />
                ) : null}
              </div>
              <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {market.question}
              </h1>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-yes">YES {yesPct.toFixed(1)}%</span>
                  <span className="text-no">NO {(100 - yesPct).toFixed(1)}%</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-bg-elev">
                  <div className="bg-yes" style={{ width: `${Math.max(2, yesPct)}%` }} />
                  <div className="bg-no" style={{ width: `${Math.max(2, 100 - yesPct)}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="YES pool" value={`${formatToken(market.yesPool)} ${STABLECOIN_SYMBOL}`} />
                <Stat label="NO pool" value={`${formatToken(market.noPool)} ${STABLECOIN_SYMBOL}`} />
                <Stat label="Total" value={`${formatToken(total)} ${STABLECOIN_SYMBOL}`} />
                <Stat label="Resolves" value={formatDate(market.resolutionTime)} />
              </div>
            </CardContent>
          </Card>

          <ProbabilityChart
            data={history ?? []}
            isLoading={historyLoading}
            currentYesPct={yesPct}
          />

          <TradeHistory
            trades={history ?? []}
            isLoading={historyLoading}
            error={historyError as Error | null | undefined}
          />
        </div>

        <div className="space-y-4">
          {market.state === MarketState.Active ? (
            <BetPanel market={market} />
          ) : (
            <Card className="p-5 text-center">
              <Badge variant={stateBadge.variant} className="mx-auto">
                {stateBadge.label}
              </Badge>
              <p className="mt-3 text-sm text-text-muted">
                Betting is closed. Use the panel below to claim if you have a position.
              </p>
            </Card>
          )}
          <PositionPanel market={market} />

          <Card>
            <CardContent className="space-y-3 p-6 text-sm">
              <div className="flex items-center gap-2 text-text-muted">
                <ScrollText className="h-4 w-4" />
                Market info
              </div>
              <Detail label="Market ID" value={`#${market.id.toString()}`} />
              <Detail label="Created" value={formatDate(market.createdAt)} />
              <Detail label="Resolution time" value={formatDate(market.resolutionTime)} />
              <Detail
                label="Creator"
                value={
                  <span className="inline-flex items-center gap-1">
                    <User2 className="h-3.5 w-3.5" />
                    {shortAddr(market.creator)}
                  </span>
                }
              />
              <Detail
                label="Creation fee"
                value={`${formatToken(market.creationFee)} ${STABLECOIN_SYMBOL}`}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg/50 p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-sm">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t border-line pt-3 first:border-0 first:pt-0">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
