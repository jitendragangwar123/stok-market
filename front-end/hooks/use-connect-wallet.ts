"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";

/**
 * Single source of truth for the wallet-connect button state.
 *
 * Privy distinguishes between two things:
 *  1. `authenticated` — the user has a Privy session (email / social / wallet)
 *  2. having an active EVM wallet — `useAccount().address` from wagmi
 *
 * The two can be out of sync (e.g. user signed in with email but never linked
 * an external wallet, or hasn't created the embedded one yet). Calling
 * `login()` while `authenticated` is true throws
 *   "Attempted to log in, but user is already logged in."
 * — so we must dispatch to `connectWallet()` instead in that case.
 */
export function useConnectWallet() {
  const { ready, authenticated, login, logout, connectWallet } = usePrivy();
  const { address } = useAccount();

  const isConnected = authenticated && !!address;

  function connect() {
    if (!ready) return;
    if (!authenticated) {
      login();
    } else if (!address) {
      connectWallet();
    }
  }

  return {
    ready,
    authenticated,
    address,
    isConnected,
    connect,
    logout,
  };
}
