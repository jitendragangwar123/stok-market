"use client";

import Link from "next/link";
import type { Market } from "@/hooks/use-markets";
import { MarketState, outcomeLabel } from "@/lib/contracts";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Countdown } from "./countdown";
import { formatTokenWithSymbol, pct, shortAddr } from "@/lib/format";
import { TrendingUp } from "lucide-react";

export function MarketCard({ market }: { market: Market }) {
  const total = market.yesPool + market.noPool;
  const yesPct = pct(market.yesPool, total);
  const noPct = 100 - yesPct;
  const stateBadge = stateBadgeFor(market);

  return (
    <Link
      href={`/markets/${market.id.toString()}`}
      className="group block animate-in"
    >
      <Card className="relative overflow-hidden transition-all hover:border-brand/40 hover:shadow-glow">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand/10 blur-3xl opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
            {market.state === MarketState.Active ? (
              <Countdown resolutionTime={market.resolutionTime} />
            ) : (
              <span className="text-xs text-text-muted">#{market.id.toString()}</span>
            )}
          </div>

          <h3 className="mt-3 line-clamp-2 text-balance text-lg font-semibold leading-snug tracking-tight">
            {market.question}
          </h3>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-yes">YES {yesPct.toFixed(1)}%</span>
              <span className="text-no">NO {noPct.toFixed(1)}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-bg-elev">
              <div
                className="bg-yes transition-all"
                style={{ width: `${Math.max(2, yesPct)}%` }}
              />
              <div
                className="bg-no transition-all"
                style={{ width: `${Math.max(2, noPct)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-text-muted">
            <div className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{formatTokenWithSymbol(total)}</span>
            </div>
            <span className="font-mono">by {shortAddr(market.creator)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function stateBadgeFor(m: Market): { label: string; variant: "active" | "resolved" | "cancelled" } {
  if (m.state === MarketState.Active) return { label: "Active", variant: "active" };
  if (m.state === MarketState.Resolved) {
    return {
      label: `Resolved · ${outcomeLabel[m.winningOutcome]}`,
      variant: "resolved",
    };
  }
  return { label: "Cancelled", variant: "cancelled" };
}
