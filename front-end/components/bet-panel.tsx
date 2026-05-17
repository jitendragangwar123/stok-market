"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/input";
import { Card } from "./ui/card";
import {
  FAUCET_AMOUNT,
  useAllowance,
  useApprove,
  useMintTestTokens,
  usePlaceBet,
  useTokenBalance,
} from "@/hooks/use-actions";
import { useConnectWallet } from "@/hooks/use-connect-wallet";
import { MarketState, Outcome, STABLECOIN_SYMBOL } from "@/lib/contracts";
import type { Market } from "@/hooks/use-markets";
import { formatToken, parseToken, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Wallet, Zap } from "lucide-react";

export function BetPanel({ market }: { market: Market }) {
  const { isConnected, authenticated, address, connect } = useConnectWallet();
  const [side, setSide] = useState<Outcome.Yes | Outcome.No>(Outcome.Yes);
  const [input, setInput] = useState("");

  const { data: balance, refetch: refetchBalance } = useTokenBalance();
  const { data: allowance, refetch: refetchAllowance } = useAllowance();
  const { approve, isPending: approving } = useApprove();
  const { placeBet, isPending: betting } = usePlaceBet();
  const { mint, isPending: minting } = useMintTestTokens();

  const amount = parseToken(input || "0");
  const total = market.yesPool + market.noPool;
  const yesPct = pct(market.yesPool, total);

  const expired = Number(market.resolutionTime) * 1000 <= Date.now();
  const closed = market.state !== MarketState.Active || expired;

  const balanceBn = (balance as bigint | undefined) ?? 0n;
  const allowanceBn = (allowance as bigint | undefined) ?? 0n;
  const insufficientBalance = amount > balanceBn;
  const needsApproval = amount > 0n && allowanceBn < amount;

  const projectedPayout = projectPayout(market, side, amount);

  if (!isConnected) {
    return (
      <Card className="p-6 text-center">
        <Wallet className="mx-auto h-8 w-8 text-text-muted" />
        <p className="mt-3 text-sm text-text-muted">
          {authenticated
            ? "Link an EVM wallet to place a bet."
            : "Connect a wallet to place a bet."}
        </p>
        <Button onClick={connect} className="mt-4 w-full">
          {authenticated ? "Connect Wallet" : "Connect Wallet"}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide(Outcome.Yes)}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              side === Outcome.Yes
                ? "border-yes/60 bg-yes/10 ring-2 ring-yes/30"
                : "border-line bg-bg-elev hover:border-yes/40"
            )}
          >
            <div className="text-xs uppercase tracking-wider text-text-muted">Bet YES</div>
            <div className="mt-1 font-mono text-lg font-medium text-yes">
              {yesPct.toFixed(1)}%
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSide(Outcome.No)}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              side === Outcome.No
                ? "border-no/60 bg-no/10 ring-2 ring-no/30"
                : "border-line bg-bg-elev hover:border-no/40"
            )}
          >
            <div className="text-xs uppercase tracking-wider text-text-muted">Bet NO</div>
            <div className="mt-1 font-mono text-lg font-medium text-no">
              {(100 - yesPct).toFixed(1)}%
            </div>
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount">Amount ({STABLECOIN_SYMBOL})</Label>
            <button
              className="text-xs text-text-muted hover:text-text"
              onClick={() => setInput(formatTokenInput(balanceBn))}
              disabled={!balance}
            >
              Balance: {formatToken(balanceBn)}
            </button>
          </div>
          <div className="relative">
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.0"
              value={input}
              onChange={(e) => setInput(sanitizeNumeric(e.target.value))}
              disabled={closed}
              className="font-mono pr-20"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              {[10, 50, 100].map((p) => (
                <button
                  key={p}
                  className="rounded-md bg-bg-card px-2 py-1 text-xs text-text-muted hover:bg-bg-hover hover:text-text"
                  onClick={() =>
                    setInput(formatTokenInput((balanceBn * BigInt(p)) / 100n))
                  }
                >
                  {p === 100 ? "MAX" : `${p}%`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-bg/40 p-3 text-xs">
          <Row label="Side" value={side === Outcome.Yes ? "YES" : "NO"} />
          <Row
            label="Projected payout if you win"
            value={`${formatToken(projectedPayout)} ${STABLECOIN_SYMBOL}`}
          />
          <Row
            label="Implied edge"
            value={
              amount > 0n
                ? `${(((Number(projectedPayout - amount) || 0) / Number(amount || 1n)) * 100).toFixed(1)}%`
                : "—"
            }
          />
        </div>

        <div className="mt-5">
          {closed ? (
            <Button disabled className="w-full">
              Market closed
            </Button>
          ) : insufficientBalance ? (
            <Button
              variant="primary"
              className="w-full"
              loading={minting}
              onClick={async () => {
                await mint(FAUCET_AMOUNT);
                await refetchBalance();
              }}
            >
              {minting
                ? "Minting…"
                : `Get ${formatToken(FAUCET_AMOUNT)} ${STABLECOIN_SYMBOL}`}
            </Button>
          ) : needsApproval ? (
            <Button
              variant="primary"
              className="w-full"
              loading={approving}
              disabled={amount === 0n}
              onClick={async () => {
                await approve(amount);
                await refetchAllowance();
              }}
            >
              {approving ? "Approving…" : `Approve ${STABLECOIN_SYMBOL}`}
            </Button>
          ) : (
            <Button
              variant={side === Outcome.Yes ? "yes" : "no"}
              className="w-full"
              loading={betting}
              disabled={amount === 0n || !address}
              onClick={() => placeBet(market.id, side, amount)}
            >
              {!betting && <Zap className="h-4 w-4" />}
              {betting ? "Submitting…" : `Bet ${input || "0"} on ${side === Outcome.Yes ? "YES" : "NO"}`}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function projectPayout(market: Market, side: Outcome, amount: bigint): bigint {
  if (amount === 0n) return 0n;
  if (side === Outcome.Yes) {
    const newYes = market.yesPool + amount;
    if (market.noPool === 0n || newYes === 0n) return amount;
    return amount + (amount * market.noPool) / newYes;
  } else {
    const newNo = market.noPool + amount;
    if (market.yesPool === 0n || newNo === 0n) return amount;
    return amount + (amount * market.yesPool) / newNo;
  }
}

function sanitizeNumeric(s: string): string {
  return s.replace(/[^\d.]/g, "").replace(/(\..*?)\..*/g, "$1");
}

function formatTokenInput(v: bigint): string {
  // Display whole units without symbol — simpler than parseUnits round-trip for the user.
  // Use token decimals for fidelity.
  // Re-import not needed — keep simple.
  // (Caller uses parseToken on submit anyway.)
  // 6 decimals assumed for stablecoin display
  const s = v.toString();
  const decimals = 6;
  if (s.length <= decimals) {
    return ("0." + s.padStart(decimals, "0")).replace(/0+$/, "").replace(/\.$/, "");
  }
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
