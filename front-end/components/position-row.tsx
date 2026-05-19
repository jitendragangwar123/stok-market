"use client";

import Link from "next/link";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { STABLECOIN_SYMBOL, outcomeLabel } from "@/lib/contracts";
import { formatToken, formatTokenWithSymbol } from "@/lib/format";
import type { UserPositionRow, PositionStatus } from "@/hooks/use-user-positions";
import { ChevronRight } from "lucide-react";

export function PositionRow({ row }: { row: UserPositionRow }) {
  const { market, position, payout, status } = row;
  return (
    <li>
      <Link
        href={`/markets/${market.id.toString()}`}
        className="group block animate-in"
      >
        <Card className="transition-all hover:border-brand/40 hover:shadow-glow">
          <div className="flex items-start gap-4 p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} winningOutcome={market.winningOutcome} />
                <span className="text-xs text-text-muted">#{market.id.toString()}</span>
              </div>
              <h3 className="line-clamp-2 text-balance text-base font-medium leading-snug">
                {market.question}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {position.yesBet > 0n && (
                  <span className="text-yes">
                    YES <span className="font-mono">{formatToken(position.yesBet)}</span>
                  </span>
                )}
                {position.noBet > 0n && (
                  <span className="text-no">
                    NO <span className="font-mono">{formatToken(position.noBet)}</span>
                  </span>
                )}
                <span className="text-text-muted">
                  staked{" "}
                  <span className="font-mono">
                    {formatTokenWithSymbol(position.yesBet + position.noBet)}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-right">
              {status === "Claimable" && (
                <>
                  <div className="text-xs text-text-muted">Payout</div>
                  <div className="font-mono text-sm font-semibold text-yes">
                    {formatToken(payout)} {STABLECOIN_SYMBOL}
                  </div>
                </>
              )}
              {status === "Claimed" && (
                <>
                  <div className="text-xs text-text-muted">Claimed</div>
                  <div className="font-mono text-sm text-text-muted">—</div>
                </>
              )}
              <ChevronRight className="mt-1 h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
            </div>
          </div>
        </Card>
      </Link>
    </li>
  );
}

export function StatusBadge({
  status,
  winningOutcome,
}: {
  status: PositionStatus;
  winningOutcome: UserPositionRow["market"]["winningOutcome"];
}) {
  switch (status) {
    case "Claimable":
      return <Badge variant="yes">Claimable</Badge>;
    case "Active":
      return <Badge variant="active">Active</Badge>;
    case "AwaitingResolution":
      return <Badge variant="warn">Awaiting resolution</Badge>;
    case "Claimed":
      return <Badge variant="resolved">Claimed</Badge>;
    case "NoWinnings":
      return (
        <Badge variant="cancelled">
          Lost · {outcomeLabel[winningOutcome] || "Resolved"}
        </Badge>
      );
  }
}
