"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { isAddress, getAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PositionRow } from "@/components/position-row";
import { useConnectWallet } from "@/hooks/use-connect-wallet";
import { useUserPositions } from "@/hooks/use-user-positions";
import { useUserProfile, type ClaimRecord } from "@/hooks/use-user-profile";
import { addressExplorerUrl, txExplorerUrl } from "@/hooks/use-market-history";
import { STABLECOIN_SYMBOL } from "@/lib/contracts";
import { formatToken, formatRelativeTime, shortAddr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowUpRight, History, User2, Wallet } from "lucide-react";

export default function ProfilePage() {
  const { address: addressParam } = useParams<{ address: string }>();
  const { ready, isConnected, connect } = useConnectWallet();

  if (!ready) {
    return <Skeleton className="h-64" />;
  }

  if (!isConnected) {
    return <ConnectWalletPrompt connect={connect} />;
  }

  if (!addressParam || !isAddress(addressParam)) {
    return <InvalidAddress />;
  }
  // Checksum the param so the URL canonicalizes but lookups still happen lowercase.
  const address = getAddress(addressParam) as `0x${string}`;
  return <ProfileContent address={address} />;
}

function ConnectWalletPrompt({ connect }: { connect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-20 text-center">
      <Wallet className="h-8 w-8 text-text-muted" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        Connect a wallet to view profile activity and lifetime stats.
      </p>
      <Button onClick={connect} className="mt-6">
        <Wallet className="h-4 w-4" />
        Connect wallet
      </Button>
    </div>
  );
}

function ProfileContent({ address }: { address: `0x${string}` }) {
  const { profile, claims, isLoading: profileLoading, isIndexerEnabled } = useUserProfile(address);
  const { rows, isLoading: positionsLoading } = useUserPositions(address);

  // P&L math: join claims (by market id) to positions to get realized net per market.
  const stats = useMemo(() => computeStats(rows, claims), [rows, claims]);

  const openPositions = useMemo(
    () => rows.filter((r) => r.status === "Active" || r.status === "AwaitingResolution"),
    [rows]
  );
  const closedPositions = useMemo(
    () =>
      rows
        .filter((r) => r.status === "Claimable" || r.status === "Claimed" || r.status === "NoWinnings")
        .sort((a, b) => Number(b.market.resolutionTime - a.market.resolutionTime)),
    [rows]
  );

  const addrExplorer = addressExplorerUrl(address);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/40 shadow-glow">
            <User2 className="h-5 w-5 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">
                {shortAddr(address)}
              </h1>
              {addrExplorer && (
                <a
                  href={addrExplorer}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-text-muted transition-colors hover:text-brand"
                  title="View on explorer"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
            {profile && (
              <p className="text-xs text-text-muted">
                Joined {formatRelativeTime(profile.firstSeenAt)}
              </p>
            )}
          </div>
        </div>
      </header>

      {!isIndexerEnabled && <IndexerRequiredNotice />}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Lifetime volume"
          value={profile ? `${formatToken(profile.totalVolume)} ${STABLECOIN_SYMBOL}` : "—"}
          loading={profileLoading}
          hint={profile ? `${profile.totalBets} bets` : undefined}
        />
        <StatCard
          label="Total claimed"
          value={profile ? `${formatToken(profile.totalClaimed)} ${STABLECOIN_SYMBOL}` : "—"}
          loading={profileLoading}
          hint={`${claims.length} claim${claims.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Realized P&L"
          value={formatSigned(stats.realizedPnl)}
          loading={positionsLoading || profileLoading}
          tone={stats.realizedPnl > 0n ? "good" : stats.realizedPnl < 0n ? "bad" : "neutral"}
          hint="Net across finalized + claimable positions"
        />
        <StatCard
          label="Open stake"
          value={`${formatToken(stats.openExposure)} ${STABLECOIN_SYMBOL}`}
          loading={positionsLoading}
          hint={`${openPositions.length} active`}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Open positions</h2>
          <span className="text-xs text-text-muted">{openPositions.length}</span>
        </div>
        {positionsLoading && rows.length === 0 ? (
          <Skeleton className="h-24" />
        ) : openPositions.length === 0 ? (
          <EmptySection text="No open positions." />
        ) : (
          <ul className="space-y-3">
            {openPositions.map((r) => (
              <PositionRow key={r.market.id.toString()} row={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Closed positions</h2>
          <span className="text-xs text-text-muted">{closedPositions.length}</span>
        </div>
        {positionsLoading && rows.length === 0 ? (
          <Skeleton className="h-24" />
        ) : closedPositions.length === 0 ? (
          <EmptySection text="No closed positions yet." />
        ) : (
          <ul className="space-y-3">
            {closedPositions.map((r) => (
              <PositionRow key={r.market.id.toString()} row={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <History className="h-4 w-4" />
            Claim history
          </h2>
          <span className="text-xs text-text-muted">{claims.length}</span>
        </div>
        <ClaimsTable claims={claims} isLoading={profileLoading} isIndexerEnabled={isIndexerEnabled} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  loading,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  tone?: "good" | "bad" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-text-muted">{label}</div>
        {loading ? (
          <Skeleton className="h-6 w-24" />
        ) : (
          <div
            className={cn(
              "font-mono text-lg font-semibold",
              tone === "good" && "text-yes",
              tone === "bad" && "text-no"
            )}
          >
            {value}
          </div>
        )}
        {hint && <div className="text-xs text-text-dim">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ClaimsTable({
  claims,
  isLoading,
  isIndexerEnabled,
}: {
  claims: ClaimRecord[];
  isLoading: boolean;
  isIndexerEnabled: boolean;
}) {
  if (!isIndexerEnabled) {
    return <EmptySection text="Claim history requires the indexer." />;
  }
  if (isLoading && claims.length === 0) {
    return <Skeleton className="h-24" />;
  }
  if (claims.length === 0) {
    return <EmptySection text="No claims yet." />;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-text-muted">
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Market</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => {
              const tx = txExplorerUrl(c.txHash as `0x${string}`);
              return (
                <tr
                  key={c.id}
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
                        {formatRelativeTime(c.timestamp)}
                        <ArrowUpRight className="h-3 w-3 opacity-60" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-text-muted">
                        {formatRelativeTime(c.timestamp)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-middle">
                    <Link
                      href={`/markets/${c.market.id.toString()}`}
                      className="line-clamp-1 text-xs hover:text-brand"
                      title={c.market.question}
                    >
                      {c.market.question}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right align-middle">
                    <span className="font-mono text-xs text-yes">
                      +{formatToken(c.amount)} {STABLECOIN_SYMBOL}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-10 text-center text-sm text-text-muted">
      {text}
    </div>
  );
}

function InvalidAddress() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-bg-card/40 px-6 py-20 text-center">
      <Wallet className="h-8 w-8 text-text-muted" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Invalid address</h1>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        The URL doesn&apos;t look like a valid Ethereum address.
      </p>
      <Link
        href="/markets"
        className="mt-4 text-xs text-brand transition-colors hover:text-brand-hover"
      >
        Browse markets →
      </Link>
    </div>
  );
}

function IndexerRequiredNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-xs">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <div className="space-y-1">
        <div className="font-medium text-text">Limited profile — no indexer configured.</div>
        <p className="text-text-muted">
          Profile aggregates and claim history are derived from indexed events. Set{" "}
          <span className="font-mono">NEXT_PUBLIC_INDEXER_URL</span> to enable them. Open
          positions below are still read directly from the contract.
        </p>
      </div>
    </div>
  );
}

// ---------- P&L math ----------

type Stats = {
  realizedPnl: bigint; // (claimed + claimable payouts) - cost basis on those positions
  openExposure: bigint; // sum of stakes on Active + AwaitingResolution positions
};

function computeStats(
  rows: ReturnType<typeof useUserPositions>["rows"],
  claims: ClaimRecord[]
): Stats {
  // marketId → claim.amount. Each market has at most one claim per user.
  const claimByMarketId = new Map<string, bigint>();
  for (const c of claims) {
    claimByMarketId.set(c.market.id.toString(), c.amount);
  }

  let realizedPnl = 0n;
  let openExposure = 0n;

  for (const r of rows) {
    const stake = r.position.yesBet + r.position.noBet;
    if (r.status === "Active" || r.status === "AwaitingResolution") {
      openExposure += stake;
      continue;
    }
    if (r.status === "Claimed") {
      const claimAmount = claimByMarketId.get(r.market.id.toString()) ?? 0n;
      realizedPnl += claimAmount - stake;
    } else if (r.status === "Claimable") {
      realizedPnl += r.payout - stake;
    } else if (r.status === "NoWinnings") {
      realizedPnl -= stake;
    }
  }

  return { realizedPnl, openExposure };
}

function formatSigned(v: bigint): string {
  if (v === 0n) return `0 ${STABLECOIN_SYMBOL}`;
  const sign = v > 0n ? "+" : "-";
  const abs = v < 0n ? -v : v;
  return `${sign}${formatToken(abs)} ${STABLECOIN_SYMBOL}`;
}
