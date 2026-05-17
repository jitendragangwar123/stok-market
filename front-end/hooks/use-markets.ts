"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { PREDICTION_MARKET_ABI } from "@/lib/abi";
import { PREDICTION_MARKET_ADDRESS, MarketState, Outcome } from "@/lib/contracts";
import {
  indexerEnabled,
  indexer,
  ALL_MARKETS_QUERY,
  MARKET_BY_ID_QUERY,
  USER_POSITION_QUERY,
  indexerMarketToMarket,
  type AllMarketsResponse,
  type MarketByIdResponse,
  type UserPositionResponse,
} from "@/lib/indexer";

export type Market = {
  id: bigint;
  question: string;
  resolutionTime: bigint;
  state: MarketState;
  winningOutcome: Outcome;
  yesPool: bigint;
  noPool: bigint;
  creationFee: bigint;
  creator: `0x${string}`;
  createdAt: bigint;
  configSnapshot: { feeRecipient: `0x${string}`; maxFeePercentage: bigint };
};

export type Position = {
  yesBet: bigint;
  noBet: bigint;
  claimed: boolean;
};

/**
 * Market count is always RPC-backed: single cheap call, and the indexer doesn't
 * surface a counter primitive (its `Market` table length is the same answer at
 * the cost of a list query).
 */
export function useMarketCount() {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarketCount",
    query: { refetchInterval: 10_000 },
  });
}

// ---------- useMarket(id) ----------

export function useMarket(id?: bigint): { data: Market | undefined; isLoading: boolean } {
  const idStr = id?.toString();

  const indexerQuery = useQuery({
    queryKey: ["indexer.market", idStr ?? "none"],
    queryFn: async (): Promise<Market | undefined> => {
      if (!idStr) return undefined;
      const data = await indexer.request<MarketByIdResponse>(MARKET_BY_ID_QUERY, {
        id: idStr,
      });
      return data.Market_by_pk ? indexerMarketToMarket(data.Market_by_pk) : undefined;
    },
    enabled: indexerEnabled && id !== undefined && id > 0n,
    refetchInterval: 5_000,
  });

  const rpcQuery = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarket",
    args: id !== undefined ? [id] : undefined,
    query: {
      enabled: !indexerEnabled && id !== undefined && id > 0n,
      refetchInterval: 10_000,
    },
  });

  if (indexerEnabled) {
    return { data: indexerQuery.data, isLoading: indexerQuery.isLoading };
  }
  return {
    data: rpcQuery.data as Market | undefined,
    isLoading: rpcQuery.isLoading,
  };
}

// ---------- useUserPosition(id, user) ----------

export function useUserPosition(
  id: bigint | undefined,
  user?: `0x${string}`
): { data: Position | undefined; isLoading: boolean } {
  const positionId = id !== undefined && user ? `${id.toString()}-${user.toLowerCase()}` : undefined;

  const indexerQuery = useQuery({
    queryKey: ["indexer.position", positionId ?? "none"],
    queryFn: async (): Promise<Position | undefined> => {
      if (!positionId) return undefined;
      const data = await indexer.request<UserPositionResponse>(USER_POSITION_QUERY, {
        id: positionId,
      });
      const p = data.UserPosition_by_pk;
      if (!p) return { yesBet: 0n, noBet: 0n, claimed: false };
      return {
        yesBet: BigInt(p.yesAmount),
        noBet: BigInt(p.noAmount),
        claimed: p.claimed,
      };
    },
    enabled: indexerEnabled && positionId !== undefined,
    refetchInterval: 4_000,
  });

  const rpcQuery = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getUserPosition",
    args: id !== undefined && user ? [id, user] : undefined,
    query: { enabled: !indexerEnabled && id !== undefined && !!user, refetchInterval: 4_000 },
  });

  if (indexerEnabled) {
    return { data: indexerQuery.data, isLoading: indexerQuery.isLoading };
  }
  return {
    data: rpcQuery.data as Position | undefined,
    isLoading: rpcQuery.isLoading,
  };
}

// ---------- useMarkets() ----------

export function useMarkets(): { markets: Market[]; isLoading: boolean; count: number } {
  // Indexer path
  const indexerQuery = useQuery({
    queryKey: ["indexer.markets"],
    queryFn: async (): Promise<Market[]> => {
      const data = await indexer.request<AllMarketsResponse>(ALL_MARKETS_QUERY);
      return data.Market.map(indexerMarketToMarket);
    },
    enabled: indexerEnabled,
    refetchInterval: 5_000,
  });

  // RPC fan-out path (kept intact for the !indexerEnabled fallback)
  const { data: countRaw } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarketCount",
    query: { refetchInterval: 10_000, enabled: !indexerEnabled },
  });
  const count = typeof countRaw === "bigint" ? Number(countRaw) : 0;
  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

  const { data: rpcMarkets, isLoading: rpcLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: PREDICTION_MARKET_ADDRESS,
      abi: PREDICTION_MARKET_ABI as any,
      functionName: "getMarket",
      args: [id],
    })),
    query: { enabled: !indexerEnabled && count > 0, refetchInterval: 10_000 },
  });

  if (indexerEnabled) {
    const markets = indexerQuery.data ?? [];
    return {
      markets,
      isLoading: indexerQuery.isLoading,
      count: markets.length,
    };
  }

  const markets: Market[] =
    rpcMarkets?.flatMap((r) => (r.status === "success" ? [r.result as Market] : [])) ?? [];
  return { markets, isLoading: rpcLoading, count };
}

// ---------- useCalculatePayout (always RPC) ----------

export function useCalculatePayout(id: bigint | undefined, user?: `0x${string}`) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "calculatePayout",
    args: id !== undefined && user ? [id, user] : undefined,
    query: { enabled: id !== undefined && !!user, refetchInterval: 8_000 },
  });
}

// ---------- useAdmin (always RPC) ----------

export function useAdmin() {
  const { data } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "config",
  });
  if (Array.isArray(data)) {
    return data[0] as `0x${string}` | undefined;
  }
  return undefined;
}
