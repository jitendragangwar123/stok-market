"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { PREDICTION_MARKET_ABI } from "@/lib/abi";
import { PREDICTION_MARKET_ADDRESS, MarketState, Outcome } from "@/lib/contracts";

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

export function useMarketCount() {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarketCount",
    query: { refetchInterval: 10_000 },
  });
}

export function useMarket(id?: bigint) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarket",
    args: id !== undefined ? [id] : undefined,
    query: {
      enabled: id !== undefined && id > 0n,
      refetchInterval: 10_000,
    },
  }) as ReturnType<typeof useReadContract> & { data: Market | undefined };
}

export function useUserPosition(id: bigint | undefined, user?: `0x${string}`) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getUserPosition",
    args: id !== undefined && user ? [id, user] : undefined,
    query: { enabled: id !== undefined && !!user, refetchInterval: 4_000 },
  }) as ReturnType<typeof useReadContract> & {
    data: { yesBet: bigint; noBet: bigint; claimed: boolean } | undefined;
  };
}

export function useMarkets() {
  const { data: countRaw } = useMarketCount();
  const count = typeof countRaw === "bigint" ? Number(countRaw) : 0;

  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

  const { data, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: PREDICTION_MARKET_ADDRESS,
      abi: PREDICTION_MARKET_ABI as any,
      functionName: "getMarket",
      args: [id],
    })),
    query: { enabled: count > 0, refetchInterval: 10_000 },
  });

  const markets: Market[] =
    data?.flatMap((r) => (r.status === "success" ? [r.result as Market] : [])) ?? [];

  return { markets, isLoading, count };
}

export function useCalculatePayout(id: bigint | undefined, user?: `0x${string}`) {
  return useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "calculatePayout",
    args: id !== undefined && user ? [id, user] : undefined,
    query: { enabled: id !== undefined && !!user, refetchInterval: 8_000 },
  });
}

export function useAdmin() {
  const { data } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "config",
  });
  // config returns a tuple — admin is the first field
  if (Array.isArray(data)) {
    return data[0] as `0x${string}` | undefined;
  }
  return undefined;
}
