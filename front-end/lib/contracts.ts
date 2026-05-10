import type { Address } from "viem";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

export const PREDICTION_MARKET_ADDRESS =
  (process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as Address) ??
  ("0x0000000000000000000000000000000000000000" as Address);

export const STABLECOIN_ADDRESS =
  (process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS as Address) ??
  ("0x0000000000000000000000000000000000000000" as Address);

export const STABLECOIN_DECIMALS = Number(
  process.env.NEXT_PUBLIC_STABLECOIN_DECIMALS ?? 6
);

export const STABLECOIN_SYMBOL = process.env.NEXT_PUBLIC_STABLECOIN_SYMBOL ?? "mUSDC";

export enum MarketState {
  Active = 0,
  Resolved = 1,
  Cancelled = 2,
}

export enum Outcome {
  None = 0,
  Yes = 1,
  No = 2,
}

export const stateLabel: Record<MarketState, string> = {
  [MarketState.Active]: "Active",
  [MarketState.Resolved]: "Resolved",
  [MarketState.Cancelled]: "Cancelled",
};

export const outcomeLabel: Record<Outcome, string> = {
  [Outcome.None]: "None",
  [Outcome.Yes]: "Yes",
  [Outcome.No]: "No",
};
