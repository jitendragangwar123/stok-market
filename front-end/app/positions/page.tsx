"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnectWallet } from "@/hooks/use-connect-wallet";
import { useUserPositions, type UserPositionRow, type PositionStatus } from "@/hooks/use-user-positions";
import { useClaimMany } from "@/hooks/use-actions";
import { STABLECOIN_SYMBOL, outcomeLabel } from "@/lib/contracts";
import { formatToken, formatTokenWithSymbol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronRight, Trophy, Wallet } from "lucide-react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "claimable", label: "Claimable" },
  { id: "active", label: "Active" },
  { id: "awaiting", label: "Awaiting" },
  { id: "closed", label: "Closed" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

// Sort priority — higher = nearer the top.
const STATUS_RANK: Record<PositionStatus, number> = {
  Claimable: 4,
  AwaitingResolution: 3,
  Active: 2,
  NoWinnings: 1,
  Claimed: 0,
};

export default function PositionsPage() {
  const { address } = useAccount();
  const { ready, isConnected, connect } = useConnectWallet();
  const { rows, claimableIds, totalClaimable, isLoading } = useUserPositions();
  const { claimMany, isPending } = useClaimMany();
  const [filter, setFilter] = useState<FilterId>("all");

  const filtered = useMemo(() => {
    const matches = (r: UserPositionRow) => {
      if (filter === "all") return true;
      if (filter === "claimable") return r.status === "Claimable";
      if (filter === "active") return r.status === "Active";
      if (filter === "awaiting") return r.status === "AwaitingResolution";
      return r.status === "Claimed" || r.status === "NoWinnings";
    };
    return rows
      .filter(matches)
      .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  }, [rows, filter]);

  if (!ready) {
    return <Skeleton className="h-64" />;
  }

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-20 text-center">
        <Wallet className="h-8 w-8 text-text-muted" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Your positions</h1>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          Connect a wallet to see every market you&apos;ve taken a side on and claim winnings in one
          go.
        </p>
        <Button onClick={connect} className="mt-6">
          <Wallet className="h-4 w-4" />
          Connect wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your positions</h1>
          <p className="mt-1 text-sm text-text-muted">
            All of your YES/NO bets across markets. Claim winnings individually or batch the lot
            in one transaction.
          </p>
        </div>
        <ClaimAllCTA
          claimableCount={claimableIds.length}
          total={totalClaimable}
          loading={isPending}
          onClaim={() => claimMany(claimableIds)}
        />
      </header>

      <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg-card/60 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id ? "bg-bg-elev text-text" : "text-text-muted hover:text-text"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <PositionRow key={row.market.id.toString()} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClaimAllCTA({
  claimableCount,
  total,
  loading,
  onClaim,
}: {
  claimableCount: number;
  total: bigint;
  loading: boolean;
  onClaim: () => void;
}) {
  const disabled = claimableCount === 0 || loading;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-bg-card/60 px-4 py-3">
      <div className="text-right">
        <div className="text-xs text-text-muted">Claimable</div>
        <div className="font-mono text-base font-semibold text-yes">
          {formatToken(total)} {STABLECOIN_SYMBOL}
        </div>
      </div>
      <Button
        variant={disabled ? "secondary" : "primary"}
        disabled={disabled}
        loading={loading}
        onClick={onClaim}
      >
        {!loading && <Trophy className="h-4 w-4" />}
        {claimableCount === 0
          ? "Nothing to claim"
          : loading
            ? "Claiming…"
            : `Claim all (${claimableCount})`}
      </Button>
    </div>
  );
}

function PositionRow({ row }: { row: UserPositionRow }) {
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

function StatusBadge({
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

function EmptyState({ filter }: { filter: FilterId }) {
  const message =
    filter === "all"
      ? "You haven't placed any bets yet."
      : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} positions.`;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-16 text-center">
      <div className="text-sm text-text-muted">{message}</div>
      <Link
        href="/markets"
        className="mt-3 text-xs text-brand transition-colors hover:text-brand-hover"
      >
        Browse markets →
      </Link>
    </div>
  );
}
