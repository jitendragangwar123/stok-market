"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  FAUCET_AMOUNT,
  useAllowance,
  useApprove,
  useCreateMarket,
  useMintTestTokens,
  useTokenBalance,
} from "@/hooks/use-actions";
import { useConnectWallet } from "@/hooks/use-connect-wallet";
import { formatToken, parseToken } from "@/lib/format";
import { STABLECOIN_SYMBOL } from "@/lib/contracts";
import { Calendar, Coins, HelpCircle, Sparkles } from "lucide-react";

const QUICK_DURATIONS = [
  { label: "1 day", seconds: 86_400 },
  { label: "1 week", seconds: 7 * 86_400 },
  { label: "1 month", seconds: 30 * 86_400 },
  { label: "3 months", seconds: 90 * 86_400 },
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { isConnected, address, connect } = useConnectWallet();

  const [question, setQuestion] = useState("");
  const [resolutionAt, setResolutionAt] = useState<Date>(
    () => new Date(Date.now() + 7 * 86_400 * 1000)
  );
  const [feeStr, setFeeStr] = useState("0");

  // `now` is frozen on first render so the picker's `min` doesn't drift each
  // re-render — otherwise selected days briefly disable themselves around
  // midnight boundaries.
  const minDate = useMemo(() => new Date(), []);

  const { data: allowance, refetch } = useAllowance();
  const { data: balance, refetch: refetchBalance } = useTokenBalance();
  const { approve, isPending: approving } = useApprove();
  const { create, isPending: creating } = useCreateMarket();
  const { mint, isPending: minting } = useMintTestTokens();

  const fee = parseToken(feeStr || "0");
  const allowanceBn = (allowance as bigint | undefined) ?? 0n;
  const balanceBn = (balance as bigint | undefined) ?? 0n;
  const needsApproval = fee > 0n && allowanceBn < fee;
  const insufficientBalance = fee > 0n && balanceBn < fee;

  const ts = Math.floor(resolutionAt.getTime() / 1000);
  const valid = question.trim().length > 0 && ts > Math.floor(Date.now() / 1000);

  async function onSubmit() {
    if (!valid) return;
    const tx = await create(question.trim(), BigInt(ts), fee);
    if (tx) router.push("/markets");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Badge variant="active">
          <Sparkles className="h-3 w-3" />
          New market
        </Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create a market</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ask a clearly-resolvable yes/no question. The market closes at the resolution time;
          the admin then reports the winner.
        </p>
      </div>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4" /> Your {STABLECOIN_SYMBOL} balance
            </CardTitle>
            <CardDescription>
              You need {STABLECOIN_SYMBOL} to cover the optional creation fee and to place bets.
              On the testnet you can mint some for free.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-2xl">
              {formatToken(balanceBn)}{" "}
              <span className="text-sm text-text-muted">{STABLECOIN_SYMBOL}</span>
            </div>
            <Button
              variant="secondary"
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
          <CardDescription>
            Phrase it so a YES/NO answer is unambiguous when the resolution time hits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='e.g. "Will ETH close above $5,000 on 2026-12-31?"'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
          />
          <div className="text-xs text-text-dim">{question.length}/300</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Resolution time
          </CardTitle>
          <CardDescription>When betting closes and the question can be settled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateTimePicker value={resolutionAt} onChange={setResolutionAt} min={minDate} />
          <div className="flex flex-wrap gap-2">
            {QUICK_DURATIONS.map((d) => (
              <Button
                key={d.label}
                variant="secondary"
                size="sm"
                onClick={() => setResolutionAt(new Date(Date.now() + d.seconds * 1000))}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" /> Creation fee (optional)
          </CardTitle>
          <CardDescription>
            One-time fee paid to the protocol fee recipient. Use 0 for no fee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Label htmlFor="fee" className="sr-only">
              Fee
            </Label>
            <Input
              id="fee"
              inputMode="decimal"
              placeholder="0"
              value={feeStr}
              onChange={(e) =>
                setFeeStr(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*?)\..*/g, "$1"))
              }
              className="font-mono"
            />
            <span className="text-sm text-text-muted">{STABLECOIN_SYMBOL}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        {!isConnected ? (
          <Button onClick={connect} size="lg">
            Connect Wallet
          </Button>
        ) : insufficientBalance ? (
          <Button
            size="lg"
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
            loading={approving}
            size="lg"
            onClick={async () => {
              await approve(fee);
              await refetch();
            }}
          >
            {approving ? "Approving…" : `Approve ${STABLECOIN_SYMBOL}`}
          </Button>
        ) : (
          <Button
            loading={creating}
            disabled={!address || !valid}
            size="lg"
            onClick={onSubmit}
          >
            {creating ? "Creating…" : "Launch market"}
          </Button>
        )}
      </div>
    </div>
  );
}

