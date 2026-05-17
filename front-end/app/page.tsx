"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bitcoin,
  CircleHelp,
  Cpu,
  Flag,
  Flame,
  Layers,
  LineChart,
  Sparkles,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import { useMarkets } from "@/hooks/use-markets";
import { MarketCard } from "@/components/market-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketState } from "@/lib/contracts";
import { formatTokenWithSymbol } from "@/lib/format";

const CATEGORIES = [
  { id: "politics", label: "Politics", icon: Vote },
  { id: "crypto", label: "Crypto", icon: Bitcoin },
  { id: "sports", label: "Sports", icon: Trophy },
  { id: "tech", label: "Tech", icon: Cpu },
  { id: "economy", label: "Economy", icon: LineChart },
  { id: "culture", label: "Pop Culture", icon: Flame },
  { id: "world", label: "World", icon: Flag },
];

const STEPS = [
  {
    n: "01",
    title: "Pick a question",
    body: "Browse live markets or launch your own. Every market is a clearly-stated YES/NO question with an on-chain resolution time.",
  },
  {
    n: "02",
    title: "Take a position",
    body: "Stake mUSDC on the outcome you believe in. The pool you join determines your share of the prize.",
  },
  {
    n: "03",
    title: "Claim your winnings",
    body: "When the market resolves, winners split the losing pool pro-rata. Pull your funds with a single transaction — no custodian, no waiting.",
  },
];

const FAQ = [
  {
    q: "What is Stok Market?",
    a: "Stok Market is a binary prediction marketplace. Anyone can ask a YES/NO question about a real-world event, stake a stablecoin on the answer they expect, and settle proportionally against the losing side once the question resolves.",
  },
  {
    q: "How do payouts work?",
    a: "If you backed the winning side, you get your stake back plus a pro-rata share of the losing pool: payout = userBet + userBet × losingPool / winningPool. Losing-side stakes are forfeit. Refunds are full on cancellation.",
  },
  {
    q: "Who decides the outcome?",
    a: "A designated admin reports the winning outcome after the resolution time. If the admin disappears, anyone can permissionlessly cancel the market 90 days after the resolution time so funds aren't held hostage.",
  },
  {
    q: "Is this audited?",
    a: "No. Stok Market is an educational, unaudited prediction-market dApp. Don't use it with funds you can't afford to lose. The contract source is open and tested with 86 unit tests.",
  },
  {
    q: "What is mUSDC?",
    a: "Mock USDC — a test stablecoin deployed alongside the contract for development. You can mint some directly from the create-market or bet flow.",
  },
];

export default function LandingPage() {
  const { markets, count } = useMarkets();

  const stats = useMemo(() => {
    const active = markets.filter((m) => m.state === MarketState.Active);
    const resolved = markets.filter((m) => m.state === MarketState.Resolved);
    const totalLocked = active.reduce((s, m) => s + m.yesPool + m.noPool, 0n);
    const volume = markets.reduce((s, m) => s + m.yesPool + m.noPool, 0n);
    return {
      active: active.length,
      resolved: resolved.length,
      totalLocked,
      volume,
    };
  }, [markets]);

  const featured = useMemo(() => {
    const active = markets.filter((m) => m.state === MarketState.Active);
    const sorted = [...active].sort((a, b) => {
      const ta = a.yesPool + a.noPool;
      const tb = b.yesPool + b.noPool;
      return tb > ta ? 1 : tb < ta ? -1 : 0;
    });
    return sorted.slice(0, 6);
  }, [markets]);

  return (
    <div className="space-y-24 pb-16">
      <Hero
        totalMarkets={count}
        activeMarkets={stats.active}
        totalLocked={formatTokenWithSymbol(stats.totalLocked)}
        volume={formatTokenWithSymbol(stats.volume)}
      />

      <Categories />

      <FeaturedMarkets markets={featured} />

      <HowItWorks />

      <Faq />

      <CtaStrip />

      <Footer />
    </div>
  );
}

/* --------------------------------- Hero ---------------------------------- */

function Hero({
  totalMarkets,
  activeMarkets,
  totalLocked,
  volume,
}: {
  totalMarkets: number;
  activeMarkets: number;
  totalLocked: string;
  volume: string;
}) {
  return (
    <section className="relative">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-bg-card/40 px-6 py-16 sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50" />
        <div className="pointer-events-none absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-elev/60 px-3 py-1 text-xs">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yes animate-pulse" />
              <span className="text-text-muted">Live · {activeMarkets} active markets</span>
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              A marketplace for
              <br />
              <span className="bg-gradient-to-r from-brand via-brand-hover to-yes bg-clip-text text-transparent">
                what happens next.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-balance text-text-muted">
              Trade the outcome of real-world events. Take a position on politics, crypto, sports,
              and economics — settled transparently on-chain when the answer is known.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/markets">
                <Button variant="primary" size="lg">
                  Explore markets
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/markets/create">
                <Button variant="secondary" size="lg">
                  Create a market
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-brand" /> On-chain settlement
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-brand" /> Non-custodial
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-brand" /> Permissionless
              </span>
            </div>
          </div>

          <HeroStatBoard
            totalMarkets={totalMarkets}
            activeMarkets={activeMarkets}
            totalLocked={totalLocked}
            volume={volume}
          />
        </div>
      </div>
    </section>
  );
}

function HeroStatBoard({
  totalMarkets,
  activeMarkets,
  totalLocked,
  volume,
}: {
  totalMarkets: number;
  activeMarkets: number;
  totalLocked: string;
  volume: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        icon={<BarChart3 className="h-4 w-4" />}
        label="Markets"
        value={String(totalMarkets)}
        sub={`${activeMarkets} active`}
      />
      <StatTile
        icon={<LineChart className="h-4 w-4" />}
        label="Open interest"
        value={totalLocked}
      />
      <StatTile
        icon={<Sparkles className="h-4 w-4" />}
        label="Lifetime volume"
        value={volume}
      />
      <StatTile
        icon={<BadgeCheck className="h-4 w-4" />}
        label="Protocol fee"
        value="0%"
        sub="No spread, no rake"
      />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg-card/70 p-4">
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className="text-brand">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 font-mono text-xl font-medium tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-dim">{sub}</div>}
    </div>
  );
}

/* ------------------------------ Categories ------------------------------- */

function Categories() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Browse by topic</h2>
          <p className="mt-1 text-sm text-text-muted">
            From elections to crypto and box-office hits — trade what you actually follow.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href="/markets"
            className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-bg-card/50 p-4 text-center transition-all hover:border-brand/40 hover:bg-bg-elev"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-elev text-brand transition-colors group-hover:bg-brand/15">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Featured markets --------------------------- */

function FeaturedMarkets({ markets }: { markets: ReturnType<typeof useMarkets>["markets"] }) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Badge variant="active">
            <Flame className="h-3 w-3" />
            Trending now
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Most-traded markets</h2>
          <p className="mt-1 text-sm text-text-muted">
            Ranked by open interest. Click into any market to take a side.
          </p>
        </div>
        <Link
          href="/markets"
          className="hidden items-center gap-1 text-sm text-text-muted hover:text-text sm:inline-flex"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {markets.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-text-muted">
            No active markets yet. Be the first to launch one.
          </p>
          <Link href="/markets/create" className="mt-4 inline-block">
            <Button variant="primary">Create a market</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m) => (
            <MarketCard key={m.id.toString()} market={m} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ----------------------------- How it works ----------------------------- */

function HowItWorks() {
  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <Badge variant="warn">
          <Layers className="h-3 w-3" />
          How it works
        </Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Three steps from question to payout
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Stok Market is pull-based and non-custodial. Your funds are in the contract, not on a
          ledger we control.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n} className="relative overflow-hidden p-6">
            <div className="absolute right-4 top-4 font-mono text-xs text-text-dim">{s.n}</div>
            <div className="mt-2 text-lg font-semibold tracking-tight">{s.title}</div>
            <p className="mt-2 text-sm text-text-muted">{s.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- FAQ ---------------------------------- */

function Faq() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
      <div>
        <Badge variant="warn">
          <CircleHelp className="h-3 w-3" />
          Questions
        </Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Things worth knowing
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          The short version of how Stok Market works, who runs it, and what could go wrong.
        </p>
      </div>

      <div className="divide-y divide-line rounded-2xl border border-line bg-bg-card/40">
        {FAQ.map((item, i) => (
          <details key={i} className="group p-5 [&_summary]:list-none">
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <span className="font-medium">{item.q}</span>
              <span className="text-text-muted transition-transform group-open:rotate-45">
                <PlusIcon />
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* ------------------------------ CTA strip ------------------------------- */

function CtaStrip() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand/10 via-bg-card/60 to-bg-card px-6 py-12 sm:px-12">
      <div className="pointer-events-none absolute -left-32 -top-32 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
      <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to put a number on it?
          </h3>
          <p className="mt-2 max-w-xl text-sm text-text-muted">
            Open a position in seconds. Pull your winnings the moment a market resolves.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/markets">
            <Button variant="primary" size="lg">
              Explore markets
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/markets/create">
            <Button variant="secondary" size="lg">
              Launch a market
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Footer -------------------------------- */

function Footer() {
  return (
    <footer className="rounded-2xl border border-line bg-bg-card/40 p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-hover">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold tracking-tight">Stok Market</span>
            <Badge variant="warn">beta</Badge>
          </div>
          <p className="mt-2 max-w-md text-xs text-text-dim">
            Educational, unaudited prediction-market dApp. Don't trade with funds you can't afford
            to lose. Resolution relies on a trusted admin until a decentralized oracle is wired in.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-muted">
          <Link href="/markets" className="hover:text-text">
            Markets
          </Link>
          <Link href="/markets/create" className="hover:text-text">
            Create
          </Link>
          <Link href="/admin" className="hover:text-text">
            Admin
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 hover:text-text"
          >
            GitHub <ArrowUpRight className="h-3 w-3" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
