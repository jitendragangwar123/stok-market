"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import {
  addressExplorerUrl,
  txExplorerUrl,
  type MarketTrade,
} from "@/hooks/use-market-history";
import { STABLECOIN_SYMBOL } from "@/lib/contracts";
import { formatToken, shortAddr } from "@/lib/format";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";

const PAGE_SIZE = 10;

export function TradeHistory({
  trades,
  isLoading,
  error,
}: {
  trades: MarketTrade[];
  isLoading?: boolean;
  error?: Error | null;
}) {
  // Most-recent first for human reading.
  const ordered = useMemo(() => [...trades].reverse(), [trades]);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));

  // Clamp the page back into range whenever the underlying data shrinks
  // (e.g. between refetches, or the very first time it loads).
  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const start = page * PAGE_SIZE;
  const end = Math.min(ordered.length, start + PAGE_SIZE);
  const slice = ordered.slice(start, end);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Trade history
          </CardTitle>
          <p className="mt-1 text-xs text-text-muted">
            Every bet on this market — read directly from on-chain{" "}
            <span className="font-mono">BetPlaced</span> events. Click a row to view it on
            the block explorer.
          </p>
        </div>
        <Badge variant="warn">{trades.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {error && trades.length === 0 ? (
          <div className="m-4 flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div className="space-y-1">
              <div className="font-medium text-text">Couldn't load on-chain history.</div>
              <p className="text-text-muted">
                The RPC rejected the <span className="font-mono">eth_getLogs</span> request.
                Public testnet endpoints often rate-limit aggressively — try a dedicated
                provider (Alchemy / QuickNode) via{" "}
                <span className="font-mono">NEXT_PUBLIC_RPC_URL</span>.
              </p>
              <p className="font-mono text-[10px] text-text-dim">{error.message}</p>
            </div>
          </div>
        ) : isLoading && trades.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-text-muted">
            No trades yet. Be the first to take a side.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Bettor</th>
                  <th className="px-4 py-2 font-medium">Side</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-right font-medium">YES % after</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((t) => {
                  const tx = txExplorerUrl(t.txHash);
                  const addr = addressExplorerUrl(t.bettor);
                  const rowKey = `${t.txHash}-${t.logIndex}`;
                  const when = formatRowTime(t.rawTime);
                  const isYes = t.outcome === 1;
                  return (
                    <tr
                      key={rowKey}
                      className="border-b border-line/60 last:border-0 transition-colors hover:bg-bg-elev/40"
                    >
                      <td className="px-4 py-2.5 align-middle">
                        {tx ? (
                          <a
                            href={tx}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 font-mono text-xs text-text-muted hover:text-text"
                          >
                            {when}
                            <ArrowUpRight className="h-3 w-3 opacity-60" />
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-text-muted">{when}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {addr ? (
                          <a
                            href={addr}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-mono text-xs hover:text-brand"
                          >
                            {shortAddr(t.bettor)}
                          </a>
                        ) : (
                          <span className="font-mono text-xs">{shortAddr(t.bettor)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <span
                          className={
                            "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium " +
                            (isYes
                              ? "bg-yes/15 text-yes border border-yes/40"
                              : "bg-no/15 text-no border border-no/40")
                          }
                        >
                          {isYes ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right align-middle font-mono text-xs">
                        {formatToken(t.amount)}{" "}
                        <span className="text-text-muted">{STABLECOIN_SYMBOL}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right align-middle font-mono text-xs">
                        {t.value.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-text-muted">
                <span>
                  Showing <span className="font-mono text-text">{start + 1}</span>–
                  <span className="font-mono text-text">{end}</span> of{" "}
                  <span className="font-mono text-text">{ordered.length}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <span className="font-mono text-text">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatRowTime(unixSec: number): string {
  if (!unixSec) return "—";
  const d = new Date(unixSec * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
