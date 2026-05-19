"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { shortAddr } from "@/lib/format";
import { useConnectWallet } from "@/hooks/use-connect-wallet";
import { LogOut, Sparkles, Wallet } from "lucide-react";

export function Header() {
  const { ready, authenticated, address, isConnected, connect, logout } = useConnectWallet();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/70 border-b border-line">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-hover shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold tracking-tight">Stok</span>
              <span className="text-base font-semibold text-brand">Market</span>
              <Badge variant="warn" className="ml-1 hidden sm:inline-flex">
                beta
              </Badge>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="/markets">Markets</NavLink>
            <NavLink href="/positions">Positions</NavLink>
            <NavLink href="/markets/create">Create</NavLink>
            <NavLink href="/admin">Admin</NavLink>
          </nav>

          <div className="flex items-center gap-2">
            {!ready ? (
              <div className="h-10 w-32 animate-pulse rounded-xl bg-bg-elev" />
            ) : isConnected ? (
              <div className="flex items-center gap-2">
                <Link href={`/u/${address}`} title="Your profile">
                  <Badge variant="active" className="hidden sm:inline-flex hover:bg-brand/25">
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-yes animate-pulse" />
                    {shortAddr(address)}
                  </Badge>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  title="Disconnect"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : authenticated ? (
              // Logged into Privy but no active EVM wallet — let the user link one.
              <div className="flex items-center gap-2">
                <Button onClick={connect} variant="primary">
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={connect} variant="primary">
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-bg-elev hover:text-text"
    >
      {children}
    </Link>
  );
}
