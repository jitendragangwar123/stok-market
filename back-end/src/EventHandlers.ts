/**
 * Envio HyperIndex (v3) event handlers for the Stok Market PredictionMarket contract.
 *
 * Generated types come from `npm run codegen`, which reads `config.yaml` +
 * `schema.graphql` and emits `.envio/types.d.ts`. The `envio` module re-exports
 * everything via project-specific module augmentation, so `import { indexer }`
 * gives a fully-typed registration surface.
 *
 * Handler contract:
 *   • Stay deterministic — no Math.random / Date.now / network calls.
 *   • Read-modify-write a single entity per `context.X.set(...)` call.
 *   • Always `await context.X.get(id)` before assuming an entity exists.
 *
 * Outcome enum (mirrors the Solidity enum):
 *   0 = None, 1 = Yes, 2 = No
 *
 * Note: `outcome` and `winningOutcome` arrive as `bigint` (uint8 on-chain) — cast
 * to number for entity storage to match the schema's `Int!` columns.
 */

import { indexer } from "envio";

const OUTCOME_YES = 1;
const OUTCOME_NO = 2;

const BPS_DENOMINATOR = 10_000n;

/** Probability of YES in basis points (0..10000). 5000 == 50%. */
function yesProbabilityBps(yesPool: bigint, noPool: bigint): number {
  const total = yesPool + noPool;
  if (total === 0n) return 5000; // Empty market = 50/50 by convention
  return Number((yesPool * BPS_DENOMINATOR) / total);
}

// ---------- MarketCreated ----------

indexer.onEvent(
  { contract: "PredictionMarket", event: "MarketCreated" },
  async ({ event, context }) => {
    const marketId = event.params.marketId.toString();

    context.Market.set({
      id: marketId,
      marketId: event.params.marketId,
      question: event.params.question,
      resolutionTime: event.params.resolutionTime,
      creator: event.params.creator.toLowerCase(),
      fee: event.params.fee,

      yesPool: 0n,
      noPool: 0n,
      totalVolume: 0n,
      yesProbabilityBps: 5000,
      betCount: 0,

      state: "Active",
      winningOutcome: undefined,
      resolvedAt: undefined,
      cancelledAt: undefined,
      totalClaimed: 0n,

      createdAt: BigInt(event.block.timestamp),
      createdAtBlock: BigInt(event.block.number),
    });
  }
);

// ---------- BetPlaced ----------

indexer.onEvent(
  { contract: "PredictionMarket", event: "BetPlaced" },
  async ({ event, context }) => {
    const marketId = event.params.marketId.toString();
    const bettorAddr = event.params.bettor.toLowerCase();
    const outcome = Number(event.params.outcome);
    const amount = event.params.amount;
    const ts = BigInt(event.block.timestamp);

    // 1. Update Market pools
    const market = await context.Market.get(marketId);
    if (!market) {
      context.log.warn(`BetPlaced on unknown market ${marketId}`);
      return;
    }

    const yesPoolAfter = outcome === OUTCOME_YES ? market.yesPool + amount : market.yesPool;
    const noPoolAfter = outcome === OUTCOME_NO ? market.noPool + amount : market.noPool;
    const probBps = yesProbabilityBps(yesPoolAfter, noPoolAfter);

    context.Market.set({
      ...market,
      yesPool: yesPoolAfter,
      noPool: noPoolAfter,
      totalVolume: market.totalVolume + amount,
      yesProbabilityBps: probBps,
      betCount: market.betCount + 1,
    });

    // 2. Upsert User
    const existingUser = await context.User.get(bettorAddr);
    context.User.set({
      id: bettorAddr,
      totalBets: (existingUser?.totalBets ?? 0) + 1,
      totalVolume: (existingUser?.totalVolume ?? 0n) + amount,
      totalClaimed: existingUser?.totalClaimed ?? 0n,
      firstSeenAt: existingUser?.firstSeenAt ?? ts,
    });

    // 3. Upsert UserPosition
    const positionId = `${marketId}-${bettorAddr}`;
    const existingPos = await context.UserPosition.get(positionId);
    context.UserPosition.set({
      id: positionId,
      market_id: marketId,
      user_id: bettorAddr,
      yesAmount: (existingPos?.yesAmount ?? 0n) + (outcome === OUTCOME_YES ? amount : 0n),
      noAmount: (existingPos?.noAmount ?? 0n) + (outcome === OUTCOME_NO ? amount : 0n),
      claimed: existingPos?.claimed ?? false,
      claimAmount: existingPos?.claimAmount ?? 0n,
      updatedAt: ts,
    });

    // 4. Insert immutable Bet row (drives chart + trade history)
    context.Bet.set({
      id: `${event.transaction.hash}-${event.logIndex}`,
      market_id: marketId,
      bettor_id: bettorAddr,
      outcome,
      amount,
      yesPoolAfter,
      noPoolAfter,
      yesProbabilityBps: probBps,
      timestamp: ts,
      blockNumber: BigInt(event.block.number),
      txHash: event.transaction.hash,
    });
  }
);

// ---------- MarketResolved ----------

indexer.onEvent(
  { contract: "PredictionMarket", event: "MarketResolved" },
  async ({ event, context }) => {
    const marketId = event.params.marketId.toString();
    const market = await context.Market.get(marketId);
    if (!market) return;

    context.Market.set({
      ...market,
      state: "Resolved",
      winningOutcome: Number(event.params.winningOutcome),
      resolvedAt: BigInt(event.block.timestamp),
      yesPool: event.params.yesPool,
      noPool: event.params.noPool,
    });
  }
);

// ---------- MarketCancelled ----------

indexer.onEvent(
  { contract: "PredictionMarket", event: "MarketCancelled" },
  async ({ event, context }) => {
    const marketId = event.params.marketId.toString();
    const market = await context.Market.get(marketId);
    if (!market) return;

    context.Market.set({
      ...market,
      state: "Cancelled",
      cancelledAt: BigInt(event.block.timestamp),
      yesPool: event.params.yesPool,
      noPool: event.params.noPool,
    });
  }
);

// ---------- WinningsClaimed ----------

indexer.onEvent(
  { contract: "PredictionMarket", event: "WinningsClaimed" },
  async ({ event, context }) => {
    const marketId = event.params.marketId.toString();
    const bettorAddr = event.params.bettor.toLowerCase();
    const amount = event.params.amount;
    const ts = BigInt(event.block.timestamp);

    // 1. Append Claim row
    context.Claim.set({
      id: `${event.transaction.hash}-${event.logIndex}`,
      market_id: marketId,
      bettor_id: bettorAddr,
      amount,
      timestamp: ts,
      blockNumber: BigInt(event.block.number),
      txHash: event.transaction.hash,
    });

    // 2. Mark UserPosition as claimed
    const positionId = `${marketId}-${bettorAddr}`;
    const pos = await context.UserPosition.get(positionId);
    if (pos) {
      context.UserPosition.set({
        ...pos,
        claimed: true,
        claimAmount: amount,
        updatedAt: ts,
      });
    }

    // 3. Roll up User totals
    const user = await context.User.get(bettorAddr);
    if (user) {
      context.User.set({
        ...user,
        totalClaimed: user.totalClaimed + amount,
      });
    }

    // 4. Roll up Market totalClaimed
    const market = await context.Market.get(marketId);
    if (market) {
      context.Market.set({
        ...market,
        totalClaimed: market.totalClaimed + amount,
      });
    }
  }
);

// ---------- ConfigUpdated ----------

indexer.onEvent(
  { contract: "PredictionMarket", event: "ConfigUpdated" },
  async ({ event, context }) => {
    context.ConfigChange.set({
      id: `${event.transaction.hash}-${event.logIndex}`,
      admin: event.params.admin.toLowerCase(),
      feeRecipient: event.params.feeRecipient.toLowerCase(),
      maxFeePercentage: event.params.maxFeePercentage,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
    });
  }
);

// ---------- ContractPaused / ContractUnpaused ----------

indexer.onEvent(
  { contract: "PredictionMarket", event: "ContractPaused" },
  async ({ event, context }) => {
    context.PauseEvent.set({
      id: `${event.transaction.hash}-${event.logIndex}`,
      admin: event.params.admin.toLowerCase(),
      paused: true,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
    });
  }
);

indexer.onEvent(
  { contract: "PredictionMarket", event: "ContractUnpaused" },
  async ({ event, context }) => {
    context.PauseEvent.set({
      id: `${event.transaction.hash}-${event.logIndex}`,
      admin: event.params.admin.toLowerCase(),
      paused: false,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
    });
  }
);
