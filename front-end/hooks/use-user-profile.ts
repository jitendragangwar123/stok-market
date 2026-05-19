"use client";

import { useQuery } from "@tanstack/react-query";
import {
  indexer,
  indexerEnabled,
  indexerMarketToMarket,
  USER_PROFILE_QUERY,
  type IndexerUser,
  type UserProfileResponse,
} from "@/lib/indexer";
import type { Market } from "./use-markets";

export type ClaimRecord = {
  id: string;
  market: Market;
  amount: bigint;
  timestamp: bigint;
  blockNumber: bigint;
  txHash: string;
};

export type UserProfile = {
  address: `0x${string}`;
  totalBets: number;
  totalVolume: bigint;
  totalClaimed: bigint;
  firstSeenAt: bigint;
};

/**
 * Profile aggregates + claim history for an arbitrary address. Indexer-only —
 * the data lives in event-derived entities (User, Claim) that the RPC path
 * can't cheaply reconstruct, so when no indexer is configured this hook
 * reports `isIndexerEnabled: false` and the caller is expected to show a
 * notice instead of pretending it has the data.
 */
export function useUserProfile(address: `0x${string}` | undefined): {
  profile: UserProfile | undefined;
  claims: ClaimRecord[];
  isLoading: boolean;
  isIndexerEnabled: boolean;
} {
  const lowerAddr = address?.toLowerCase();

  const q = useQuery({
    queryKey: ["indexer.user-profile", lowerAddr ?? "none"],
    queryFn: async (): Promise<{ profile: UserProfile | undefined; claims: ClaimRecord[] }> => {
      if (!lowerAddr || !address) return { profile: undefined, claims: [] };
      const data = await indexer.request<UserProfileResponse>(USER_PROFILE_QUERY, {
        user: lowerAddr,
      });
      return {
        profile: data.User_by_pk ? userFrom(address, data.User_by_pk) : undefined,
        claims: data.Claim.map((c) => ({
          id: c.id,
          market: indexerMarketToMarket(c.market),
          amount: BigInt(c.amount),
          timestamp: BigInt(c.timestamp),
          blockNumber: BigInt(c.blockNumber),
          txHash: c.txHash,
        })),
      };
    },
    enabled: indexerEnabled && !!lowerAddr,
    refetchInterval: 10_000,
  });

  return {
    profile: q.data?.profile,
    claims: q.data?.claims ?? [],
    isLoading: indexerEnabled ? q.isLoading : false,
    isIndexerEnabled: indexerEnabled,
  };
}

function userFrom(address: `0x${string}`, u: IndexerUser): UserProfile {
  return {
    address,
    totalBets: u.totalBets,
    totalVolume: BigInt(u.totalVolume),
    totalClaimed: BigInt(u.totalClaimed),
    firstSeenAt: BigInt(u.firstSeenAt),
  };
}
