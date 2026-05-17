"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdmin, useMarkets, type Market } from "@/hooks/use-markets";
import { useAdminActions } from "@/hooks/use-actions";
import { MarketState, Outcome, STABLECOIN_SYMBOL } from "@/lib/contracts";
import { formatDate, formatToken, shortAddr } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const { address } = useAccount();
  const admin = useAdmin();
  const { markets, isLoading } = useMarkets();
  const { resolve, cancel, emergencyCancel, isPending } = useAdminActions();

  const isAdmin = address && admin && address.toLowerCase() === admin.toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Badge variant="warn">
            <ShieldAlert className="h-3 w-3" /> Admin
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">
            Resolve, cancel, or emergency-cancel markets that have passed their resolution time.
          </p>
        </div>
        {admin && (
          <div className="hidden text-right text-xs text-text-muted sm:block">
            Admin: <span className="font-mono">{shortAddr(admin)}</span>
          </div>
        )}
      </div>

      {!isAdmin && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-text-muted">
            <Lock className="h-4 w-4" />
            <span>
              Admin-only actions are gated by the contract. Connect with the admin address to
              dispatch resolutions. Anyone can run emergency-cancel after the grace period.
            </span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="space-y-3">
          {markets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-text-muted">
                No markets yet.
              </CardContent>
            </Card>
          ) : (
            markets.map((m) => (
              <AdminRow
                key={m.id.toString()}
                market={m}
                onResolveYes={() => resolve(m.id, Outcome.Yes)}
                onResolveNo={() => resolve(m.id, Outcome.No)}
                onCancel={() => cancel(m.id)}
                onEmergencyCancel={() => emergencyCancel(m.id)}
                isAdmin={!!isAdmin}
                disabled={isPending}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdminRow({
  market,
  onResolveYes,
  onResolveNo,
  onCancel,
  onEmergencyCancel,
  isAdmin,
  disabled,
}: {
  market: Market;
  onResolveYes: () => void;
  onResolveNo: () => void;
  onCancel: () => void;
  onEmergencyCancel: () => void;
  isAdmin: boolean;
  disabled: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  const resolvable = market.state === MarketState.Active && Number(market.resolutionTime) <= now;
  const GRACE = 90 * 86_400;
  const emergencyEligible =
    market.state === MarketState.Active && Number(market.resolutionTime) + GRACE <= now;

  const stateBadge =
    market.state === MarketState.Active
      ? { label: resolvable ? "Awaiting resolution" : "Active", variant: "active" as const }
      : market.state === MarketState.Resolved
      ? { label: "Resolved", variant: "resolved" as const }
      : { label: "Cancelled", variant: "cancelled" as const };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">#{market.id.toString()}</span>
            <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
          </div>
          <CardTitle className="text-base">
            <Link href={`/markets/${market.id.toString()}`} className="hover:text-brand">
              {market.question}
            </Link>
          </CardTitle>
        </div>
        <div className="text-xs text-text-muted">
          Resolves {formatDate(market.resolutionTime)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="rounded-md bg-yes/10 px-2 py-1 text-yes">
            YES {formatToken(market.yesPool)} {STABLECOIN_SYMBOL}
          </span>
          <span className="rounded-md bg-no/10 px-2 py-1 text-no">
            NO {formatToken(market.noPool)} {STABLECOIN_SYMBOL}
          </span>
        </div>

        {market.state === MarketState.Active && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="yes"
              size="sm"
              loading={disabled}
              disabled={!isAdmin || !resolvable}
              onClick={onResolveYes}
            >
              Resolve YES
            </Button>
            <Button
              variant="no"
              size="sm"
              loading={disabled}
              disabled={!isAdmin || !resolvable}
              onClick={onResolveNo}
            >
              Resolve NO
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={disabled}
              disabled={!isAdmin || !resolvable}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={disabled}
              disabled={!emergencyEligible}
              onClick={onEmergencyCancel}
              title="Permissionless after 90 days past resolutionTime"
            >
              Emergency cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
