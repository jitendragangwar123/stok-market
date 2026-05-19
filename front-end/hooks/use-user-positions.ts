"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { PREDICTION_MARKET_ABI } from "@/lib/abi";
import { PREDICTION_MARKET_ADDRESS, MarketState } from "@/lib/contracts";
import {
  indexer,
  indexerEnabled,
  indexerMarketToMarket,
  USER_POSITIONS_QUERY,
  type UserPositionsResponse,
} from "@/lib/indexer";
import { useMarkets, type Market, type Position } from "./use-markets";

export type PositionStatus =
  | "Active" // market still open for bets
  | "AwaitingResolution" // past resolutionTime, admin hasn't resolved/cancelled yet
  | "Claimable" // finalized, not yet claimed, payout > 0
  | "NoWinnings" // finalized (Resolved), not yet claimed, payout = 0 (losing side)
  | "Claimed"; // already claimed

export type UserPositionRow = {
  market: Market;
  position: Position;
  status: PositionStatus;
  payout: bigint; // 0 unless status === "Claimable"
};

function statusFor(
  market: Market,
  position: Position,
  payout: bigint,
  nowSec: bigint
): PositionStatus {
  if (position.claimed) return "Claimed";
  const finalized = market.state !== MarketState.Active;
  if (!finalized) {
    return nowSec >= market.resolutionTime ? "AwaitingResolution" : "Active";
  }
  return payout > 0n ? "Claimable" : "NoWinnings";
}

/**
 * All of the connected user's positions across every market, with derived
 * status and payout. Indexer-backed when NEXT_PUBLIC_INDEXER_URL is set —
 * one Hasura query joins UserPosition → Market. RPC fallback fans out
 * getUserPosition across markets returned by useMarkets().
 *
 * For finalized + unclaimed rows, calculatePayout is read from the contract
 * (always RPC) so the UI can show a per-row claim amount and a Claim-all total.
 */
export function useUserPositions(): {
  rows: UserPositionRow[];
  claimableIds: bigint[];
  totalClaimable: bigint;
  isLoading: boolean;
} {
  const { address } = useAccount();
  const lowerAddr = address?.toLowerCase();

  // ---- Source A: indexer ----
  const indexerQ = useQuery({
    queryKey: ["indexer.user-positions", lowerAddr ?? "none"],
    queryFn: async (): Promise<{ market: Market; position: Position }[]> => {
      if (!lowerAddr) return [];
      const data = await indexer.request<UserPositionsResponse>(
        USER_POSITIONS_QUERY,
        { user: lowerAddr }
      );
      return data.UserPosition.map((p) => ({
        market: indexerMarketToMarket(p.market),
        position: {
          yesBet: BigInt(p.yesAmount),
          noBet: BigInt(p.noAmount),
          claimed: p.claimed,
        },
      }));
    },
    enabled: indexerEnabled && !!lowerAddr,
    refetchInterval: 5_000,
  });

  // ---- Source B: RPC fan-out (used when no indexer) ----
  const { markets, isLoading: rpcMarketsLoading } = useMarkets();
  const { data: rpcPositionsRaw, isLoading: rpcPositionsLoading } = useReadContracts({
    contracts: markets.map((m) => ({
      address: PREDICTION_MARKET_ADDRESS,
      abi: PREDICTION_MARKET_ABI as any,
      functionName: "getUserPosition",
      args: [m.id, address],
    })),
    query: {
      enabled: !indexerEnabled && !!address && markets.length > 0,
      refetchInterval: 10_000,
    },
  });

  const baseRows = useMemo<{ market: Market; position: Position }[]>(() => {
    if (indexerEnabled) {
      return indexerQ.data ?? [];
    }
    if (!address || !rpcPositionsRaw) return [];
    const out: { market: Market; position: Position }[] = [];
    for (let i = 0; i < markets.length; i++) {
      const r = rpcPositionsRaw[i];
      if (!r || r.status !== "success") continue;
      const p = r.result as Position;
      if (p.yesBet === 0n && p.noBet === 0n) continue;
      out.push({ market: markets[i], position: p });
    }
    return out;
  }, [indexerQ.data, address, rpcPositionsRaw, markets]);

  // For finalized + unclaimed rows, query calculatePayout (RPC) for display + total.
  const finalizedRows = useMemo(
    () =>
      baseRows.filter(
        (r) => r.market.state !== MarketState.Active && !r.position.claimed
      ),
    [baseRows]
  );

  const { data: payouts } = useReadContracts({
    contracts: finalizedRows.map((r) => ({
      address: PREDICTION_MARKET_ADDRESS,
      abi: PREDICTION_MARKET_ABI as any,
      functionName: "calculatePayout",
      args: [r.market.id, address],
    })),
    query: {
      enabled: !!address && finalizedRows.length > 0,
      refetchInterval: 8_000,
    },
  });

  const rows: UserPositionRow[] = useMemo(() => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const payoutByMarketId = new Map<bigint, bigint>();
    finalizedRows.forEach((r, i) => {
      const result = payouts?.[i];
      if (result && result.status === "success") {
        payoutByMarketId.set(r.market.id, result.result as bigint);
      }
    });
    return baseRows.map(({ market, position }) => {
      const payout = payoutByMarketId.get(market.id) ?? 0n;
      return { market, position, payout, status: statusFor(market, position, payout, nowSec) };
    });
  }, [baseRows, finalizedRows, payouts]);

  const claimableIds = useMemo(
    () => rows.filter((r) => r.status === "Claimable").map((r) => r.market.id),
    [rows]
  );
  const totalClaimable = useMemo(
    () => rows.reduce((sum, r) => (r.status === "Claimable" ? sum + r.payout : sum), 0n),
    [rows]
  );

  return {
    rows,
    claimableIds,
    totalClaimable,
    isLoading: indexerEnabled
      ? indexerQ.isLoading
      : rpcMarketsLoading || rpcPositionsLoading,
  };
}
