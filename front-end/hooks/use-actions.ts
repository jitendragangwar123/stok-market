"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ERC20_ABI, PREDICTION_MARKET_ABI } from "@/lib/abi";
import {
  PREDICTION_MARKET_ADDRESS,
  STABLECOIN_ADDRESS,
  Outcome,
} from "@/lib/contracts";

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
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

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

  return { placeBet, hash, isPending: isPending || isMining, isSuccess };
}

export function useApprove() {
  const { writeContractAsync, isPending } = useWriteContract();
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
  return { approve, isPending };
}

export function useCreateMarket() {
  const { writeContractAsync, isPending } = useWriteContract();
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
  return { create, isPending };
}

export function useClaim() {
  const { writeContractAsync, isPending } = useWriteContract();
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
  return { claim, isPending };
}

export function useAdminActions() {
  const { writeContractAsync, isPending } = useWriteContract();

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

  return { resolve, cancel, emergencyCancel, isPending };
}

function parseRevert(e: unknown): string {
  if (!e) return "Unknown error";
  const msg = (e as { shortMessage?: string; message?: string }).shortMessage
    ?? (e as Error).message
    ?? String(e);
  return msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
}
