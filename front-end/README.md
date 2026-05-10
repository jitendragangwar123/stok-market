# Stok Market — Front-end

A modern Next.js 14 (App Router) front-end for the **PredictionMarket** smart contract in this repo. Wallet connection via **Privy** + **wagmi v2** + **viem**, styled with **Tailwind CSS** in a dark crypto aesthetic.

## Tech stack

- **Next.js 14** (App Router, React 18, Server Components)
- **TypeScript**
- **Tailwind CSS** + custom dark theme (`bg`, `brand`, `yes`, `no` palette)
- **Privy** for embedded + injected wallet auth (social/email login + MetaMask/WalletConnect)
- **wagmi v2** + **viem** for typed contract reads/writes
- **TanStack Query** (under the hood for wagmi)
- **lucide-react** icons, **sonner** toasts, **class-variance-authority** for variants

## Pages

| Route | Description |
|---|---|
| `/` | Hero + market grid with filters (Active / Resolved / Cancelled) |
| `/markets/[id]` | Market detail: pool stats, bet panel, your position + claim |
| `/markets/create` | Create-market form with quick durations & creation-fee approval |
| `/admin` | Admin dashboard: resolve YES/NO, cancel, permissionless emergency-cancel |

## Setup

```bash
cd front-end
cp .env.example .env.local
# fill in your Privy app id and the deployed contract addresses
pnpm install   # or npm install / yarn / bun install
pnpm dev       # http://localhost:3000
```

### Required env vars

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | App id from [dashboard.privy.io](https://dashboard.privy.io) |
| `NEXT_PUBLIC_CHAIN_ID` | `31337` (Anvil), `84532` (Base Sepolia), `8453` (Base), … |
| `NEXT_PUBLIC_RPC_URL` | RPC endpoint for that chain |
| `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS` | Address from `forge script Deploy.s.sol` |
| `NEXT_PUBLIC_STABLECOIN_ADDRESS` | USDC / mUSDC address |
| `NEXT_PUBLIC_STABLECOIN_DECIMALS` | Usually `6` |
| `NEXT_PUBLIC_STABLECOIN_SYMBOL` | Display symbol (e.g. `USDC`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional — for WalletConnect via Privy |

### Local-anvil flow

1. **Anvil** (terminal 1)

   ```bash
   anvil
   ```

2. **Deploy** (terminal 2, from the repo root)

   ```bash
   PRIVATE_KEY=<anvil-key-0> \
     forge script script/DeployMockToken.s.sol:DeployMockTokenScript \
     --rpc-url http://127.0.0.1:8545 --broadcast

   PRIVATE_KEY=<anvil-key-0> \
   STABLECOIN_ADDRESS=<from previous step> \
     forge script script/Deploy.s.sol:DeployScript \
     --rpc-url http://127.0.0.1:8545 --broadcast
   ```

3. **Front-end** — paste the two addresses into `front-end/.env.local`, then `pnpm dev`.

The ABI is committed under `lib/predictionMarketAbi.json`. To regenerate after a contract change:

```bash
jq '.abi' ../out/PredictionMarket.sol/PredictionMarket.json > lib/predictionMarketAbi.json
```

## File layout

```
front-end/
├── app/
│   ├── layout.tsx                 # root layout, providers, header, toaster
│   ├── providers.tsx              # PrivyProvider + WagmiProvider + QueryClient
│   ├── globals.css                # tailwind + theme tokens
│   ├── page.tsx                   # home (hero + market grid)
│   ├── markets/[id]/page.tsx      # market detail
│   ├── markets/create/page.tsx    # create market
│   └── admin/page.tsx             # admin actions
├── components/
│   ├── header.tsx                 # nav + wallet connect
│   ├── hero.tsx                   # landing hero
│   ├── market-card.tsx            # grid card
│   ├── bet-panel.tsx              # YES/NO bet UI
│   ├── position-panel.tsx         # claim UI
│   ├── countdown.tsx              # live countdown to resolutionTime
│   └── ui/                        # button, card, input, badge, skeleton
├── hooks/
│   ├── use-markets.ts             # market(s), position, payout, admin reads
│   └── use-actions.ts             # placeBet, approve, claim, create, admin writes
├── lib/
│   ├── contracts.ts               # env-derived addresses + enums
│   ├── abi.ts                     # ABI imports (PredictionMarket + ERC20)
│   ├── predictionMarketAbi.json   # generated ABI
│   ├── wagmi.ts                   # wagmi config, chain selection
│   ├── format.ts                  # token / time formatters
│   └── utils.ts                   # cn() helper
└── (config) tailwind.config.ts, next.config.js, tsconfig.json, postcss.config.mjs
```

## Production checklist

- Set the env vars in your hosting provider (Vercel: Project Settings → Environment Variables).
- Add a real Privy app and configure allowed login methods + callback URLs in the Privy dashboard.
- Verify the deployed contract on the target chain so the bet/approve UI links can show source.
- Add error monitoring (Sentry) and analytics if needed.
- Consider running an indexer (Ponder, The Graph) to replace the on-chain `getMarket` loop on the home page once you have many markets.

## License

MIT.
