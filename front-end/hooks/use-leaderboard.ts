"use client";

import { useQuery } from "@tanstack/react-query";
import {
  indexer,
  indexerEnabled,
  LEADERBOARD_QUERY,
  type IndexerUser,
  type LeaderboardResponse,
} from "@/lib/indexer";

export type LeaderboardEntry = {
  address: `0x${string}`;
  totalBets: number;
  totalVolume: bigint;
  totalClaimed: bigint;
  firstSeenAt: bigint;
};

/**
 * Top-N users by volume and by claimed. Single Hasura query (aliased
 * order_by) so the indexer does the sorting/limiting — front-end just
 * filters out zero rows. Refreshes every 15s; fine for a leaderboard.
 */
export function useLeaderboard(limit = 25): {
  topVolume: LeaderboardEntry[];
  topClaimed: LeaderboardEntry[];
  isLoading: boolean;
  isIndexerEnabled: boolean;
} {
  const q = useQuery({
    queryKey: ["indexer.leaderboard", limit],
    queryFn: async () => {
      const data = await indexer.request<LeaderboardResponse>(LEADERBOARD_QUERY, {
        limit,
      });
      return {
        topVolume: data.byVolume.map(toEntry).filter((u) => u.totalVolume > 0n),
        topClaimed: data.byClaimed.map(toEntry).filter((u) => u.totalClaimed > 0n),
      };
    },
    enabled: indexerEnabled,
    refetchInterval: 15_000,
  });

  return {
    topVolume: q.data?.topVolume ?? [],
    topClaimed: q.data?.topClaimed ?? [],
    isLoading: indexerEnabled ? q.isLoading : false,
    isIndexerEnabled: indexerEnabled,
  };
}

function toEntry(u: IndexerUser): LeaderboardEntry {
  return {
    address: u.id as `0x${string}`,
    totalBets: u.totalBets,
    totalVolume: BigInt(u.totalVolume),
    totalClaimed: BigInt(u.totalClaimed),
    firstSeenAt: BigInt(u.firstSeenAt),
  };
}
