"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function tick(unix: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = unix - now;
  if (diff <= 0) return { ended: true, label: "ended" };

  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  if (d > 0) return { ended: false, label: `${d}d ${h}h` };
  if (h > 0) return { ended: false, label: `${h}h ${m}m` };
  if (m > 0) return { ended: false, label: `${m}m ${s}s` };
  return { ended: false, label: `${s}s` };
}

export function Countdown({ resolutionTime }: { resolutionTime: bigint }) {
  const target = Number(resolutionTime);
  const [state, setState] = useState(() => tick(target));

  useEffect(() => {
    const id = setInterval(() => setState(tick(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <Clock className="h-3 w-3" />
      <span className="font-mono">{state.ended ? "Awaiting resolution" : state.label}</span>
    </div>
  );
}
