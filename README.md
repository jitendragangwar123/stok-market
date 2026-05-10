# Stok Market — Binary Prediction Markets

A simple, pot-based **binary prediction market** smart contract built with Foundry. Users bet a stablecoin on YES/NO outcomes of a question; once the resolution time passes, an admin reports the winner and bettors on the winning side claim a proportional share of the losing pool plus their original stake.

> **Disclaimer.** This contract is for educational purposes. It is unaudited and intentionally minimal — the admin role is centralized (manual resolution), there is no fee on bets, and many production hardening steps are omitted. Do not use as-is in production.

---

## Table of contents

1. [How the market works](#how-the-market-works)
2. [Architecture & key invariants](#architecture--key-invariants)
3. [Contract API](#contract-api)
4. [Repository layout](#repository-layout)
5. [Quick start](#quick-start)
6. [Scripts (deploy & interact)](#scripts-deploy--interact)
7. [Testing](#testing)
8. [Recommended tech stack for a full product](#recommended-tech-stack-for-a-full-product)
9. [Roadmap / future work](#roadmap--future-work)

---

## How the market works

A market is a single binary question with a fixed resolution time, e.g. *"Will ETH close above $5,000 on 2026-12-31?"*.

1. **Create.** Anyone calls `createMarket(question, resolutionTime, fee)`. The optional creation fee is paid in the configured stablecoin and forwarded to `feeRecipient`.
2. **Bet.** During the active window (`now < resolutionTime`) anyone calls `placeBet(marketId, outcome, amount)`. The amount is pulled via `transferFrom` and added to either the YES or NO pool. A user may bet on both sides; bets accumulate.
3. **Resolve.** Once `now >= resolutionTime`, the admin calls `resolveMarket(marketId, winningOutcome)` declaring YES or NO the winner. If only one side has bets (no opposition), the market **auto-cancels** (full refunds) instead of forcing the admin to handle it manually.
4. **Cancel.** The admin can also call `cancelMarket(marketId)` after the resolution time to refund all bettors. **`emergencyCancel(marketId)` is permissionless** after `EMERGENCY_CANCEL_GRACE_PERIOD` (90 days) past `resolutionTime` — bettors are protected against an unresponsive admin.
5. **Claim.** Each bettor calls `claimWinnings(marketId)` (or `claimMultipleWinnings` to batch). Resolved-market payout for a winner is:

   ```
   payout = userBet + (userBet × losingPool) / winningPool
   ```

   Cancelled markets refund the full sum of all bets the user placed on either side.

### Trust model

- **Admin** can resolve markets, cancel them after expiry, update fee config, and pause new bets/markets. Admin **cannot** drain user funds, take winnings, or cancel a market mid-betting period.
- **Users** rely on the admin to report the truthful outcome. This is a centralized oracle. The grace-period emergency cancel is the last-resort guarantee that user funds aren't held hostage.

---

## Architecture & key invariants

- **Pot-based / parimutuel.** No order book. The total pool of the losing side is split among winners pro-rata to their stake. Odds are determined by the final pool ratios, not at bet time.
- **Pull payments.** `claimWinnings` is user-initiated; the contract never pushes funds.
- **Reentrancy guarded.** All state-changing entrypoints use `nonReentrant`. State is updated before any external token transfer.
- **Solvency invariant.** For each market the sum of all payouts ≤ `yesPool + noPool` (rounding only loses dust, never overpays).
- **Config snapshot.** Each market stores the fee/recipient at creation time so a later config change can't change a market's economics retroactively.
- **Pause semantics.** Pausing blocks new market creation and new bets, but **never** blocks claims — users can always exit.

### Solidity & dependencies

- Solidity `^0.8.24` (uses custom errors, immutables, modern overflow checks).
- No external dependencies in `src/` — `IERC20` is defined inline. `lib/forge-std` is dev-only for tests.

---

## Contract API

`src/PredictionMarket.sol`

### Admin

| Function | Notes |
|---|---|
| `updateConfig(address feeRecipient, uint256 maxFeePercentage)` | Validates non-zero recipient and `<= MAX_FEE_LIMIT (1000 bps)`. |
| `pause()` / `unpause()` | Idempotent guard via `AlreadyPaused` / `NotPaused`. |
| `resolveMarket(uint256 id, Outcome winner)` | Only after `resolutionTime`. Auto-cancels if one pool is empty. |
| `cancelMarket(uint256 id)` | Only after `resolutionTime`. Full refund. |

### Public

| Function | Notes |
|---|---|
| `createMarket(string question, uint256 resolutionTime, uint256 fee)` | Returns `marketId`. Charges `fee` to `feeRecipient` if > 0. |
| `placeBet(uint256 id, Outcome outcome, uint256 amount)` | YES = 1, NO = 2. Transfers `amount` stablecoin to contract. |
| `claimWinnings(uint256 id)` | Pays out per the formula above. Always callable, even when paused. |
| `claimMultipleWinnings(uint256[] ids)` | Best-effort batch — silently skips invalid / already-claimed / no-position / active. |
| `emergencyCancel(uint256 id)` | Permissionless after `resolutionTime + EMERGENCY_CANCEL_GRACE_PERIOD`. |

### Views

`getMarket`, `getUserPosition`, `calculatePayout`, `getConfig`, `getMarketCount`, plus public mappings `markets` and `userPositions`.

### Constants

| Name | Value |
|---|---|
| `MAX_FEE_LIMIT` | `1000` bps (10%) |
| `EMERGENCY_CANCEL_GRACE_PERIOD` | `90 days` |

### Custom errors (cheaper than `require`-strings)

`AlreadyClaimed`, `AlreadyPaused`, `EmptyQuestion`, `GracePeriodNotElapsed`, `InsufficientAllowance`, `InsufficientBalance`, `InvalidAddress`, `InvalidFee`, `InvalidMarket`, `InvalidOutcome`, `InvalidResolutionTime`, `MarketAlreadyFinalized`, `MarketExpired`, `MarketNotActive`, `MarketNotFinalized`, `NoPosition`, `NotAdmin`, `NotPaused`, `Paused`, `ReentrancyGuard`, `TransferFailed`, `ZeroAmount`.

---

## Repository layout

```
.
├── src/
│   ├── PredictionMarket.sol         # The market contract
│   ├── interfaces/IERC20.sol        # IERC20 + IERC20Metadata
│   └── mocks/MockERC20.sol          # Mintable test stablecoin
├── script/
│   ├── Deploy.s.sol                 # Deploys PredictionMarket
│   ├── DeployMockToken.s.sol        # Deploys MockERC20 (local/testnet)
│   ├── CreateMarket.s.sol           # Creates a market on a deployed contract
│   └── Interact.s.sol               # placeBet / claim / resolve / cancel / view
├── test/unit/PredictionMarket.t.sol # 86 unit tests across 11 suites
├── foundry.toml                     # Foundry profile + lint config
├── lib/forge-std                    # Foundry std lib (test/script helpers)
└── README.md
```

---

## Quick start

### Prerequisites

- **Foundry** (`forge`, `cast`, `anvil`) — install via [foundryup](https://book.getfoundry.sh/getting-started/installation).
- **Git** with submodule support (this repo uses `forge-std` as a submodule under `lib/`).

### Setup

```bash
git clone <this-repo>
cd stok-market
git submodule update --init --recursive   # pulls forge-std
forge build
forge test
```

A successful run prints `86 tests passed, 0 failed`.

---

## Scripts (deploy & interact)

All scripts read configuration from environment variables. `PRIVATE_KEY` is the deployer/caller key. State-changing scripts need `--rpc-url` and `--broadcast`.

### 1. Deploy a mock stablecoin (local / testnet only)

```bash
PRIVATE_KEY=0x... \
TOKEN_NAME="Mock USDC" TOKEN_SYMBOL="mUSDC" \
TOKEN_DECIMALS=6 TOKEN_INITIAL_SUPPLY=1000000 \
forge script script/DeployMockToken.s.sol:DeployMockTokenScript \
  --rpc-url $RPC_URL --broadcast
```

### 2. Deploy PredictionMarket

```bash
PRIVATE_KEY=0x... \
STABLECOIN_ADDRESS=0xYourStablecoin \
ADMIN_ADDRESS=0xAdmin \
FEE_RECIPIENT=0xFees \
MAX_FEE_BPS=500 \
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $RPC_URL --broadcast
```

### 3. Create a market

```bash
PRIVATE_KEY=0x... \
PREDICTION_MARKET=0xMarket \
MARKET_QUESTION="Will ETH > \$5k by 2026-12-31?" \
MARKET_RESOLUTION_TIME=1798761600 \
MARKET_CREATION_FEE=0 \
forge script script/CreateMarket.s.sol:CreateMarketScript \
  --rpc-url $RPC_URL --broadcast
```

### 4. Interact (multiple sub-actions)

| Action | Sig | Required env |
|---|---|---|
| Place a bet | `placeBet()` | `MARKET_ID`, `BET_OUTCOME` (1=Yes, 2=No), `BET_AMOUNT` (with decimals) |
| Claim a single market | `claim()` | `MARKET_ID` |
| Claim multiple | `claimMultiple()` | `MARKET_IDS=1,2,3` |
| Admin resolve | `resolve()` | `MARKET_ID`, `RESOLVE_OUTCOME` |
| Admin cancel | `cancel()` | `MARKET_ID` |
| Permissionless emergency cancel | `emergencyCancel()` | `MARKET_ID` |
| Read-only view | `viewMarket()` | `MARKET_ID`, optional `USER_ADDRESS` |

Example:

```bash
PRIVATE_KEY=0x... PREDICTION_MARKET=0xMarket \
MARKET_ID=1 BET_OUTCOME=1 BET_AMOUNT=10000000 \
forge script script/Interact.s.sol:InteractScript \
  --sig "placeBet()" --rpc-url $RPC_URL --broadcast
```

For local development, run `anvil` in a separate terminal and point `RPC_URL=http://127.0.0.1:8545`. Anvil prints 10 funded test accounts with their private keys at startup — use one as `PRIVATE_KEY`.

---

## Testing

```bash
forge test                  # run all suites
forge test --summary        # tabular per-suite summary
forge test -vvv             # show traces on failure
forge coverage              # line/branch coverage
forge snapshot              # update gas snapshots
```

The `test/unit/PredictionMarket.t.sol` file contains **86 unit tests** across **11 suites**:

| Suite | Coverage |
|---|---|
| `ConstructorTests` | zero/non-zero params, max-fee bound, deployment state |
| `AdminConfigTests` | `updateConfig`, `pause`, `unpause` |
| `CreateMarketTests` | with/without fee, edge cases, counter |
| `PlaceBetTests` | YES/NO, accumulation, all reverts, exact-resolution-time boundary |
| `ResolveMarketTests` | success, auth, timing, invalid outcome, auto-cancel on one-sided pool |
| `CancelMarketTests` | success, auth, pre-resolution revert, double-cancel |
| `EmergencyCancelTests` | grace-period boundary, refund flow, already-finalized |
| `ClaimWinningsTests` | YES/NO wins, both-sides bettor, cancelled refund, dust invariant |
| `ClaimMultipleWinningsTests` | batch, skip-invalid/claimed/active, duplicates, empty array |
| `ViewFunctionTests` | `getMarket`, `calculatePayout` parity with claim, `getConfig` |
| `ReentrancyTests` | malicious ERC20 callback into `claimWinnings` blocked by `nonReentrant` |

---

## Recommended tech stack for a full product

The on-chain contract is the **source of truth**, but a usable product needs indexing, an API, and a UI on top. The stack below is one opinionated choice — substitute equivalents as you prefer.

### Smart contract layer (already in this repo)

| Concern | Tool |
|---|---|
| Language | Solidity `^0.8.24` |
| Build / test | Foundry (`forge`, `anvil`, `cast`) |
| Local devnet | `anvil` |
| Stablecoin | USDC on the target chain (this repo ships a `MockERC20` for local/testnet) |
| Target chains | Any EVM L2 — Base, Arbitrum, Optimism — for low gas. Mainnet for credibility, but high cost. |

### Off-chain indexer & API (back-end)

A naive front-end calling `getMarket(id)` for many markets is slow and brittle. Index the events instead.

| Concern | Recommended | Why |
|---|---|---|
| Indexer | **Ponder** (TypeScript) or **The Graph** (subgraph) | Index `MarketCreated`, `BetPlaced`, `MarketResolved`, `MarketCancelled`, `WinningsClaimed`. Ponder gives you a typed Postgres DB; The Graph gives a hosted GraphQL endpoint. |
| Database | **PostgreSQL** | Ponder writes here. Stores markets, bets, positions, computed pool totals. |
| API | **GraphQL** (built-in to Ponder/Graph) or **Node/TypeScript REST** (Hono / Fastify) | Front-end consumes pool sizes, leaderboards, user histories. |
| Cache / pub-sub | **Redis** | Cache market lists, push live odds updates over WebSocket. |
| RPC provider | **Alchemy / Infura / QuickNode** | Reliable archive RPC for indexing; a public RPC is fine for read calls from the UI. |
| Server-side wallet (optional) | **Viem** + a key-manager (KMS / [Privy](https://privy.io) server signer) | Only needed if you offer admin actions through the dashboard. |

### Front-end (web app)

| Concern | Recommended | Why |
|---|---|---|
| Framework | **Next.js** (React, App Router) | SSR/SEO for market pages; great DX. Alternatives: Remix, Vite + React. |
| Styling | **Tailwind CSS** + **shadcn/ui** | Utility-first; copy-paste components. |
| Web3 reads/writes | **wagmi** + **viem** | Typed hooks (`useReadContract`, `useWriteContract`, `useWatchContractEvent`). |
| Wallet UX | **RainbowKit** or **ConnectKit** | Multi-wallet connector (MetaMask, WalletConnect, Coinbase, Safe). |
| State | **TanStack Query** (already used by wagmi) | Caching, retries, optimistic updates. |
| Charts | **Recharts** or **Visx** | Pool ratios over time, odds curves. |
| Forms | **React Hook Form** + **Zod** | Validate bet amounts, resolution times. |

### Auth / accounts (optional but common)

| Concern | Recommended |
|---|---|
| Wallet-based login | **SIWE** (Sign-In With Ethereum) |
| Embedded wallets / social login | **Privy** or **Dynamic** |
| Account abstraction (gasless UX) | **ZeroDev** / **Biconomy** / **Pimlico** + ERC-4337 paymaster |

### DevOps / hosting

| Concern | Recommended |
|---|---|
| Front-end hosting | **Vercel** (Next.js native) |
| Indexer + API hosting | **Railway**, **Render**, or **Fly.io** |
| Postgres | Managed Postgres on the same provider, or **Neon** / **Supabase** |
| CI | **GitHub Actions** — run `forge fmt --check`, `forge build`, `forge test` on each PR |
| Contract verification | **Etherscan** (per chain) — add the API key to `foundry.toml` and run `forge verify-contract` |
| Monitoring | **Tenderly** for tx tracing, **Defender** for admin multisig + automated cancels |

### Suggested service topology

```
                                ┌────────────┐
                                │  Browser   │
                                │ (Next.js)  │
                                └─────┬──────┘
                                      │ wagmi/viem (writes)
                  ┌───────────────────┼──────────────────────────┐
                  ▼ GraphQL / REST    ▼ JSON-RPC                 ▼ events
            ┌──────────┐         ┌──────────┐               ┌──────────┐
            │   API    │◀────────│   RPC    │──────────────▶│ Indexer  │
            │ (Hono)   │         │ provider │               │ (Ponder) │
            └────┬─────┘         └─────┬────┘               └────┬─────┘
                 │                     │                         │
                 ▼                     ▼                         ▼
            ┌──────────┐         ┌──────────────┐           ┌──────────┐
            │ Postgres │         │ EVM chain    │           │ Postgres │
            │  cache   │         │ (Base/Arb)   │           │  events  │
            └──────────┘         └──────────────┘           └──────────┘
```

The browser **writes** straight to the chain through the user's wallet. The browser **reads** from the indexer's API for fast queries, and falls back to direct RPC reads for the freshest state.

---

## Roadmap / future work

In rough priority order:

- **Decentralized resolution.** Replace the trusted admin with an oracle (UMA, Reality.eth) or a multi-sig of resolvers.
- **ERC20 hardening.** Wrap transfers with a SafeERC20-style pattern to support non-bool-returning tokens (USDT) and balance-based accounting for fee-on-transfer tokens.
- **Bet fees.** Optional `betFeeBps` taken on each `placeBet` and routed to `feeRecipient` (the storage and snapshot already exist).
- **Categorical markets.** Generalize from binary YES/NO to *N* outcomes.
- **Liquidity-provider markets.** AMM (LMSR / CPMM) instead of parimutuel for continuous odds and instant fills.
- **Subgraph + UI.** Ponder indexer + Next.js front-end (see stack above).
- **Audit.** Professional review before any mainnet deployment.

---

## License

MIT — see SPDX headers in source files.
