"use client";

/**
 * GraphQL client for the Envio HyperIndex (`back-end/`).
 *
 * Envio surfaces a Hasura endpoint, so the query shape is Hasura-style:
 *   - Plural entity (`Market`) returns an array, accepts `where`, `order_by`, `limit`.
 *   - Singular `_by_pk(id: ...)` returns one row or null.
 *
 * `indexerEnabled` is the runtime feature flag. The hooks call both the indexer
 * and the RPC path unconditionally (React's rules of hooks), and pick the active
 * source based on this flag — so when `NEXT_PUBLIC_INDEXER_URL` is unset, the
 * RPC path keeps working exactly as before.
 */

import { GraphQLClient, gql } from "graphql-request";

export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "";

export const indexerEnabled = INDEXER_URL.length > 0;

export const indexer = new GraphQLClient(INDEXER_URL, {
  errorPolicy: "all",
});

// ---------- Query types (shape of what the indexer returns) ----------

export type IndexerMarketState = "Active" | "Resolved" | "Cancelled";

export type IndexerMarket = {
  id: string;
  marketId: string;
  question: string;
  resolutionTime: string;
  creator: string;
  fee: string;
  yesPool: string;
  noPool: string;
  totalVolume: string;
  yesProbabilityBps: number;
  betCount: number;
  state: IndexerMarketState;
  winningOutcome: number | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  totalClaimed: string;
  createdAt: string;
};

export type IndexerBet = {
  id: string;
  bettor_id: string;
  outcome: number;
  amount: string;
  yesPoolAfter: string;
  noPoolAfter: string;
  yesProbabilityBps: number;
  timestamp: string;
  blockNumber: string;
  txHash: string;
};

export type IndexerUserPosition = {
  id: string;
  market_id: string;
  user_id: string;
  yesAmount: string;
  noAmount: string;
  claimed: boolean;
  claimAmount: string;
  updatedAt: string;
};

// ---------- Queries ----------

const MARKET_FIELDS = `
  id
  marketId
  question
  resolutionTime
  creator
  fee
  yesPool
  noPool
  totalVolume
  yesProbabilityBps
  betCount
  state
  winningOutcome
  resolvedAt
  cancelledAt
  totalClaimed
  createdAt
`;

export const ALL_MARKETS_QUERY = gql`
  query AllMarkets {
    Market(order_by: { marketId: desc }) {
      ${MARKET_FIELDS}
    }
  }
`;

export const MARKET_BY_ID_QUERY = gql`
  query MarketById($id: String!) {
    Market_by_pk(id: $id) {
      ${MARKET_FIELDS}
    }
  }
`;

export const MARKET_HISTORY_QUERY = gql`
  query MarketHistory($marketId: String!) {
    Bet(
      where: { market_id: { _eq: $marketId } }
      order_by: [{ blockNumber: asc }, { id: asc }]
    ) {
      id
      bettor_id
      outcome
      amount
      yesPoolAfter
      noPoolAfter
      yesProbabilityBps
      timestamp
      blockNumber
      txHash
    }
  }
`;

export const USER_POSITION_QUERY = gql`
  query UserPosition($id: String!) {
    UserPosition_by_pk(id: $id) {
      id
      market_id
      user_id
      yesAmount
      noAmount
      claimed
      claimAmount
      updatedAt
    }
  }
`;

// ---------- Response wrappers ----------

export type AllMarketsResponse = { Market: IndexerMarket[] };
export type MarketByIdResponse = { Market_by_pk: IndexerMarket | null };
export type MarketHistoryResponse = { Bet: IndexerBet[] };
export type UserPositionResponse = { UserPosition_by_pk: IndexerUserPosition | null };

// ---------- Mappers (Indexer → on-chain-shaped types) ----------

import { MarketState, Outcome } from "@/lib/contracts";
import type { Market } from "@/hooks/use-markets";

const stateMap: Record<IndexerMarketState, MarketState> = {
  Active: MarketState.Active,
  Resolved: MarketState.Resolved,
  Cancelled: MarketState.Cancelled,
};

/**
 * The indexer doesn't store `configSnapshot` (it's not in any event), but the
 * front-end's `Market` type carries it. Nothing currently reads it, so a zero
 * stub keeps the type happy without a separate RPC round-trip.
 */
const CONFIG_SNAPSHOT_STUB = {
  feeRecipient: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  maxFeePercentage: 0n,
};

export function indexerMarketToMarket(m: IndexerMarket): Market {
  return {
    id: BigInt(m.marketId),
    question: m.question,
    resolutionTime: BigInt(m.resolutionTime),
    state: stateMap[m.state],
    winningOutcome: (m.winningOutcome ?? Outcome.None) as Outcome,
    yesPool: BigInt(m.yesPool),
    noPool: BigInt(m.noPool),
    creationFee: BigInt(m.fee),
    creator: m.creator as `0x${string}`,
    createdAt: BigInt(m.createdAt),
    configSnapshot: CONFIG_SNAPSHOT_STUB,
  };
}
