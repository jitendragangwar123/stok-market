import { formatUnits, parseUnits } from "viem";
import { STABLECOIN_DECIMALS, STABLECOIN_SYMBOL } from "./contracts";

export function formatToken(value: bigint | undefined, decimals = STABLECOIN_DECIMALS) {
  if (value === undefined) return "—";
  const s = formatUnits(value, decimals);
  const n = Number(s);
  if (n === 0) return "0";
  if (n < 0.01) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  if (n < 1) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  if (n < 1_000) return n.toFixed(2);
  if (n < 1_000_000) return (n / 1_000).toFixed(2) + "K";
  return (n / 1_000_000).toFixed(2) + "M";
}

export function formatTokenWithSymbol(value: bigint | undefined) {
  return `${formatToken(value)} ${STABLECOIN_SYMBOL}`;
}

export function parseToken(value: string, decimals = STABLECOIN_DECIMALS): bigint {
  if (!value) return 0n;
  return parseUnits(value, decimals);
}

export function shortAddr(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatRelativeTime(unix: bigint | number): string {
  const target = typeof unix === "bigint" ? Number(unix) : unix;
  const now = Math.floor(Date.now() / 1000);
  const diff = target - now;
  const abs = Math.abs(diff);
  const past = diff < 0;

  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [365, "d"],
  ];
  let v = abs;
  let unit = "s";
  for (const [div, label] of units) {
    if (v < div) {
      unit = label;
      break;
    }
    v = Math.floor(v / div);
    unit = label;
  }
  return past ? `${v}${unit} ago` : `in ${v}${unit}`;
}

export function formatDate(unix: bigint | number): string {
  const t = typeof unix === "bigint" ? Number(unix) : unix;
  return new Date(t * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function pct(num: bigint, den: bigint): number {
  if (den === 0n) return 50;
  return Number((num * 10000n) / den) / 100;
}
