"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base, baseSepolia, foundry, mainnet, sepolia } from "viem/chains";
import { CHAIN_ID, PREDICTION_MARKET_ADDRESS, RPC_URL } from "@/lib/contracts";

export type MarketTrade = {
  /** Strictly-increasing Unix seconds — what lightweight-charts wants for `time`. */
  time: number;
  /** Original block.timestamp before any monotonicity bump. */
  rawTime: number;
  /** YES probability in percent (0–100) AFTER this bet settled. */
  value: number;
  /** Running YES pool in raw token units after this bet. */
  yesPool: bigint;
  /** Running NO pool in raw token units after this bet. */
  noPool: bigint;
  /** Bettor address. */
  bettor: `0x${string}`;
  /** 1 = YES, 2 = NO (Outcome enum from the contract). */
  outcome: 1 | 2;
  /** Bet amount, raw token units. */
  amount: bigint;
  /** Transaction hash that emitted this BetPlaced event. */
  txHash: `0x${string}`;
  /** Block number — useful for block-explorer links. */
  blockNumber: bigint;
  /** Position within the block, for sort stability. */
  logIndex: number;
};

// Note the explicit uint8 — the Solidity event uses an enum, but viem treats enums as uint8.
const BET_PLACED_EVENT = parseAbiItem(
  "event BetPlaced(uint256 indexed marketId, address indexed bettor, uint8 outcome, uint256 amount, uint256 timestamp)"
);

/**
 * We deliberately avoid wagmi's `usePublicClient` here. With pnpm there can be two
 * parallel wagmi installations (different peer-dep hashes), so the hook resolves to
 * a different React `WagmiContext` than the one Privy's `WagmiProvider` populates,
 * throwing `WagmiProviderNotFoundError`. Going straight to viem sidesteps that.
 */
function resolveChain() {
  if (CHAIN_ID === base.id) return base;
  if (CHAIN_ID === baseSepolia.id) return baseSepolia;
  if (CHAIN_ID === mainnet.id) return mainnet;
  if (CHAIN_ID === sepolia.id) return sepolia;
  return foundry;
}

/**
 * Localhost is the default in contracts.ts when NEXT_PUBLIC_RPC_URL is unset. If the
 * active chain isn't foundry, we want viem's built-in public RPC for that chain, not
 * a stray localhost request.
 */
function buildTransport(chainId: number) {
  const isLocal =
    RPC_URL.startsWith("http://127.0.0.1") ||
    RPC_URL.startsWith("http://localhost");
  if (chainId !== foundry.id && isLocal) return http();
  return http(RPC_URL);
}

/** Approx seconds per block for from-block estimation. */
function blockTimeSec(chainId: number): number {
  if (chainId === base.id || chainId === baseSepolia.id) return 2;
  if (chainId === sepolia.id || chainId === mainnet.id) return 12;
  return 1; // foundry
}

// sepolia.base.org caps eth_getLogs at 800 blocks per request. Pick a value that
// fits inside every public RPC we care about; a dedicated provider (Alchemy /
// QuickNode) would let you bump this much higher.
const CHUNK_SIZE = 800n;
// Only used as the safety bound when we don't yet know the market's createdAt.
const ABSOLUTE_MAX_LOOKBACK = 50_000n;

/**
 * Walk every BetPlaced event for a market and turn it into a YES-probability time series
 * with full per-trade metadata. The chart consumes (time, value); the trade-history table
 * uses the rest.
 *
 * Uses chunked eth_getLogs so the RPC isn't hit with a fromBlock=0..latest range that
 * mainnet / testnet providers reject. Bounded by `createdAt` when supplied.
 */
export function useMarketHistory(marketId?: bigint, createdAt?: bigint) {
  return useQuery<MarketTrade[]>({
    queryKey: [
      "marketHistory",
      PREDICTION_MARKET_ADDRESS,
      marketId?.toString() ?? "none",
      createdAt?.toString() ?? "0",
    ],
    enabled: marketId !== undefined,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (marketId === undefined) return [];

      const chain = resolveChain();
      const client = createPublicClient({
        chain,
        transport: buildTransport(chain.id),
      });

      const currentBlock = await client.getBlockNumber();

      // Estimate a sensible from-block. Anvil is small enough to scan from 0; for live
      // chains use createdAt + an over-estimate of blocks.
      let minBlock = 0n;
      if (chain.id !== foundry.id) {
        if (createdAt && createdAt > 0n) {
          const head = await client.getBlock({ blockNumber: currentBlock });
          const elapsed = Math.max(0, Number(head.timestamp) - Number(createdAt));
          const blocksAgo =
            BigInt(Math.ceil(elapsed / blockTimeSec(chain.id))) + 200n; // buffer
          minBlock = currentBlock > blocksAgo ? currentBlock - blocksAgo : 0n;
        } else {
          minBlock =
            currentBlock > ABSOLUTE_MAX_LOOKBACK
              ? currentBlock - ABSOLUTE_MAX_LOOKBACK
              : 0n;
        }
        // Hard cap regardless of createdAt — protects against bad input.
        if (currentBlock - minBlock > ABSOLUTE_MAX_LOOKBACK) {
          minBlock = currentBlock - ABSOLUTE_MAX_LOOKBACK;
        }
      }

      // Foundry: one shot from 0 (no RPC range limit).
      // Other chains: walk backwards in CHUNK_SIZE-block windows.
      // Type as any[] because viem's parameterized Log type doesn't survive the
      // dual-install duplication and the casts below already give us the fields.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allLogs: any[] = [];
      if (chain.id === foundry.id) {
        const logs = await client.getLogs({
          address: PREDICTION_MARKET_ADDRESS,
          event: BET_PLACED_EVENT,
          args: { marketId },
          fromBlock: 0n,
          toBlock: "latest",
        });
        allLogs.push(...logs);
      } else {
        let toBlock = currentBlock;
        while (toBlock >= minBlock) {
          const fromBlock =
            toBlock > CHUNK_SIZE + minBlock ? toBlock - CHUNK_SIZE : minBlock;
          const logs = await client.getLogs({
            address: PREDICTION_MARKET_ADDRESS,
            event: BET_PLACED_EVENT,
            args: { marketId },
            fromBlock,
            toBlock,
          });
          allLogs.push(...logs);
          if (fromBlock <= minBlock) break;
          toBlock = fromBlock - 1n;
        }
      }

      // Chain order: ascending by (blockNumber, logIndex). Both can be null on
      // pending logs — fall back to 0 in that case.
      allLogs.sort((a, b) => {
        const ab = a.blockNumber ?? 0n;
        const bb = b.blockNumber ?? 0n;
        if (ab !== bb) return ab < bb ? -1 : 1;
        return (a.logIndex ?? 0) - (b.logIndex ?? 0);
      });

      let yesPool = 0n;
      let noPool = 0n;
      let lastTime = -1;
      const out: MarketTrade[] = [];

      for (const log of allLogs) {
        const args = log.args as {
          bettor?: `0x${string}`;
          outcome?: number;
          amount?: bigint;
          timestamp?: bigint;
        };
        const outcomeRaw = args.outcome ?? 0;
        const amount = args.amount ?? 0n;
        const rawTs = args.timestamp ? Number(args.timestamp) : 0;
        const bettor = (args.bettor ??
          ("0x0000000000000000000000000000000000000000" as const)) as `0x${string}`;

        if (outcomeRaw !== 1 && outcomeRaw !== 2) continue;
        const outcome = outcomeRaw as 1 | 2;

        if (outcome === 1) yesPool += amount;
        else noPool += amount;

        const total = yesPool + noPool;
        const yesPct =
          total === 0n ? 50 : Number((yesPool * 10000n) / total) / 100;

        // lightweight-charts requires strictly-increasing, unique times. Bets in the
        // same block share `block.timestamp`. Nudge each collision forward by 1s so
        // every individual bet renders as its own point on the line.
        const time = rawTs <= lastTime ? lastTime + 1 : rawTs;
        lastTime = time;

        out.push({
          time,
          rawTime: rawTs,
          value: yesPct,
          yesPool,
          noPool,
          bettor,
          outcome,
          amount,
          txHash: log.transactionHash ?? ("0x" as `0x${string}`),
          blockNumber: log.blockNumber ?? 0n,
          logIndex: log.logIndex ?? 0,
        });
      }

      return out;
    },
  });
}

/** Build a block-explorer URL for a tx hash on the active chain, or null if unknown. */
export function txExplorerUrl(txHash: `0x${string}`): string | null {
  const chain = resolveChain();
  const base = chain.blockExplorers?.default?.url;
  if (!base) return null;
  return `${base}/tx/${txHash}`;
}

export function addressExplorerUrl(addr: `0x${string}`): string | null {
  const chain = resolveChain();
  const base = chain.blockExplorers?.default?.url;
  if (!base) return null;
  return `${base}/address/${addr}`;
}
