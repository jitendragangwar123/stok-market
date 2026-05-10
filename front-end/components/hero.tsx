"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";

export function Hero({ totalMarkets, totalLocked }: { totalMarkets: number; totalLocked: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-bg-card/40 px-6 py-16 sm:px-12">
      <div className="absolute inset-0 bg-grid-fade pointer-events-none" />
      <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
      <div className="absolute -right-32 -bottom-32 h-72 w-72 rounded-full bg-yes/20 blur-3xl" />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-elev/60 px-3 py-1 text-xs">
          <Sparkles className="h-3 w-3 text-brand" />
          <span className="text-text-muted">On-chain settlement · Permissionless betting</span>
        </div>

        <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Bet on what's next.
          <br />
          <span className="bg-gradient-to-r from-brand via-brand-hover to-yes bg-clip-text text-transparent">
            Settle on-chain.
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-balance text-text-muted">
          Stok Market is a binary prediction market where anyone can create a question, take a
          position, and walk away with a proportional share of the losing pool when the truth
          drops.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/markets/create">
            <Button variant="primary" size="lg">
              Launch a market
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="#markets">
            <Button variant="secondary" size="lg">
              Explore markets
            </Button>
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:max-w-md sm:grid-cols-3">
          <Stat icon={<Zap className="h-3.5 w-3.5" />} label="Markets" value={String(totalMarkets)} />
          <Stat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Locked" value={totalLocked} />
          <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Fee" value="0%" />
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-card/60 p-4">
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 font-mono text-lg font-medium tracking-tight">{value}</div>
    </div>
  );
}
