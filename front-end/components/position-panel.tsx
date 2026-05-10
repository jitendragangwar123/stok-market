"use client";

import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useCalculatePayout, useUserPosition } from "@/hooks/use-markets";
import { useClaim } from "@/hooks/use-actions";
import { MarketState, STABLECOIN_SYMBOL } from "@/lib/contracts";
import type { Market } from "@/hooks/use-markets";
import { formatToken } from "@/lib/format";
import { Trophy } from "lucide-react";

export function PositionPanel({ market }: { market: Market }) {
  const { address } = useAccount();
  const { data: position } = useUserPosition(market.id, address);
  const { data: payoutData } = useCalculatePayout(market.id, address);
  const { claim, isPending } = useClaim();

  if (!address) return null;
  if (!position || (position.yesBet === 0n && position.noBet === 0n)) return null;

  const finalized = market.state !== MarketState.Active;
  const claimed = position.claimed;
  const payout = (payoutData as bigint | undefined) ?? 0n;
  const canClaim = finalized && !claimed && payout > 0n;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Your position</CardTitle>
        {claimed && <Badge variant="resolved">Claimed</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label="YES bet" value={`${formatToken(position.yesBet)} ${STABLECOIN_SYMBOL}`} />
        <Row label="NO bet" value={`${formatToken(position.noBet)} ${STABLECOIN_SYMBOL}`} />
        {finalized && !claimed && (
          <Row
            label={market.state === MarketState.Cancelled ? "Refund" : "Pending payout"}
            value={`${formatToken(payout)} ${STABLECOIN_SYMBOL}`}
            highlight
          />
        )}
        {canClaim && (
          <Button
            variant="primary"
            className="w-full"
            disabled={isPending}
            onClick={() => claim(market.id)}
          >
            <Trophy className="h-4 w-4" />
            {isPending ? "Claiming…" : "Claim"}
          </Button>
        )}
        {finalized && !claimed && payout === 0n && (
          <Button variant="secondary" className="w-full" disabled>
            No winnings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={"font-mono " + (highlight ? "text-yes text-base font-medium" : "")}>
        {value}
      </span>
    </div>
  );
}
