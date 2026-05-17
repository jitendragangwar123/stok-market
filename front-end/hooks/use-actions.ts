"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { ERC20_ABI, PREDICTION_MARKET_ABI } from "@/lib/abi";
import {
  PREDICTION_MARKET_ADDRESS,
  STABLECOIN_ADDRESS,
  STABLECOIN_DECIMALS,
  STABLECOIN_SYMBOL,
  Outcome,
} from "@/lib/contracts";

export const FAUCET_AMOUNT = parseUnits("1000", STABLECOIN_DECIMALS);

/**
 * Shared post-confirmation refresh: when the tx is mined, invalidate every wagmi
 * read so balances, allowances, market state and positions repaint. `isRefreshing`
 * stays true until those refetches resolve so consumers can keep their button in a
 * loading state through the whole sign → mine → refetch window (avoids the
 * "Approve button briefly re-appears after approval" flicker).
 *
 * router.refresh() is intentionally NOT called here — every page that uses these
 * hooks is "use client", so a server-component revalidation just adds latency.
 */
function useTxRefresh(hash: `0x${string}` | undefined) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!isSuccess) return;
    let cancelled = false;
    setIsRefreshing(true);
    queryClient
      .invalidateQueries()
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuccess, queryClient]);

  return { isMining, isRefreshing, isSuccess };
}

export function useTokenBalance() {
  const { address } = useAccount();
  return useReadContract({
    address: STABLECOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
}

export function useAllowance() {
  const { address } = useAccount();
  return useReadContract({
    address: STABLECOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, PREDICTION_MARKET_ADDRESS] : undefined,
    query: { enabled: !!address },
  });
}

/** Place a bet. Caller is responsible for ensuring sufficient allowance first. */
export function usePlaceBet() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isMining, isRefreshing, isSuccess } = useTxRefresh(hash);

  const placeBet = useCallback(
    async (marketId: bigint, outcome: Outcome, amount: bigint) => {
      try {
        const tx = await writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: PREDICTION_MARKET_ABI,
          functionName: "placeBet",
          args: [marketId, outcome, amount],
        });
        toast.success("Bet submitted", { description: tx.slice(0, 14) + "…" });
        return tx;
      } catch (e) {
        toast.error("Bet failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [writeContractAsync]
  );

  return {
    placeBet,
    hash,
    isPending: isPending || isMining || isRefreshing,
    isSuccess,
  };
}

/**
 * Mint test mUSDC to the connected wallet via the MockERC20 public `mint` entry point.
 * Only safe on dev/testnet — the production stablecoin will not expose `mint`.
 */
export function useMintTestTokens() {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isMining, isRefreshing, isSuccess } = useTxRefresh(hash);

  const mint = useCallback(
    async (amount: bigint = FAUCET_AMOUNT) => {
      if (!address) {
        toast.error("Connect a wallet first");
        return;
      }
      try {
        const tx = await writeContractAsync({
          address: STABLECOIN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "mint",
          args: [address, amount],
        });
        toast.success(`Sent test ${STABLECOIN_SYMBOL}`, {
          description: tx.slice(0, 14) + "…",
        });
        return tx;
      } catch (e) {
        toast.error("Faucet failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [address, writeContractAsync]
  );
  return {
    mint,
    isPending: isPending || isMining || isRefreshing,
    isSuccess,
  };
}

export function useApprove() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isMining, isRefreshing, isSuccess } = useTxRefresh(hash);

  const approve = useCallback(
    async (amount: bigint) => {
      try {
        const tx = await writeContractAsync({
          address: STABLECOIN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [PREDICTION_MARKET_ADDRESS, amount],
        });
        toast.success("Approved");
        return tx;
      } catch (e) {
        toast.error("Approval failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [writeContractAsync]
  );
  return {
    approve,
    isPending: isPending || isMining || isRefreshing,
    isSuccess,
  };
}

export function useCreateMarket() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isMining, isRefreshing, isSuccess } = useTxRefresh(hash);

  const create = useCallback(
    async (question: string, resolutionTime: bigint, fee: bigint) => {
      try {
        const tx = await writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: PREDICTION_MARKET_ABI,
          functionName: "createMarket",
          args: [question, resolutionTime, fee],
        });
        toast.success("Market submitted");
        return tx;
      } catch (e) {
        toast.error("Create failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [writeContractAsync]
  );
  return {
    create,
    isPending: isPending || isMining || isRefreshing,
    isSuccess,
  };
}

export function useClaim() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isMining, isRefreshing, isSuccess } = useTxRefresh(hash);

  const claim = useCallback(
    async (marketId: bigint) => {
      try {
        const tx = await writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: PREDICTION_MARKET_ABI,
          functionName: "claimWinnings",
          args: [marketId],
        });
        toast.success("Claim submitted");
        return tx;
      } catch (e) {
        toast.error("Claim failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [writeContractAsync]
  );
  return {
    claim,
    isPending: isPending || isMining || isRefreshing,
    isSuccess,
  };
}

export function useAdminActions() {
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const { isMining, isRefreshing, isSuccess } = useTxRefresh(hash);

  const resolve = useCallback(
    async (id: bigint, outcome: Outcome) => {
      try {
        const tx = await writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: PREDICTION_MARKET_ABI,
          functionName: "resolveMarket",
          args: [id, outcome],
        });
        toast.success("Resolution submitted");
        return tx;
      } catch (e) {
        toast.error("Resolve failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [writeContractAsync]
  );

  const cancel = useCallback(
    async (id: bigint) => {
      try {
        const tx = await writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: PREDICTION_MARKET_ABI,
          functionName: "cancelMarket",
          args: [id],
        });
        toast.success("Cancelled");
        return tx;
      } catch (e) {
        toast.error("Cancel failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [writeContractAsync]
  );

  const emergencyCancel = useCallback(
    async (id: bigint) => {
      try {
        const tx = await writeContractAsync({
          address: PREDICTION_MARKET_ADDRESS,
          abi: PREDICTION_MARKET_ABI,
          functionName: "emergencyCancel",
          args: [id],
        });
        toast.success("Emergency cancel submitted");
        return tx;
      } catch (e) {
        toast.error("Emergency cancel failed", { description: parseRevert(e) });
        throw e;
      }
    },
    [writeContractAsync]
  );

  return {
    resolve,
    cancel,
    emergencyCancel,
    isPending: isPending || isMining || isRefreshing,
    isSuccess,
  };
}

function parseRevert(e: unknown): string {
  if (!e) return "Unknown error";
  const msg = (e as { shortMessage?: string; message?: string }).shortMessage
    ?? (e as Error).message
    ?? String(e);
  return msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
}
