# Stok Market Indexer

Envio HyperIndex indexer for the [PredictionMarket](../src/PredictionMarket.sol) contract. Reads contract events, materializes a queryable GraphQL view of every market, bet, claim, and position.

Powers the front-end's read paths:

| Front-end need | Query target |
|---|---|
| Market list + filters | `Market` |
| Probability chart on market detail | `Bet` (ordered by `timestamp`) |
| Trade history table | `Bet` (paginated by `market_id`) |
| User profile / positions | `User` + `UserPosition` + `Claim` |
| Admin audit trail | `ConfigChange` + `PauseEvent` |

## Layout

```
back-end/
├── config.yaml               network + contract config
├── schema.graphql            entity model
├── src/EventHandlers.ts      handlers for all 8 contract events
├── package.json
├── tsconfig.json
├── .env.example
└── README.md                 this file
```

Codegen emits `.envio/types.d.ts` (consumed via the `envio` module) and `envio-env.d.ts` (reference shim). Both are gitignored. Envio's local Docker stack also writes to `.envio/`.

## Prerequisites

- Node 20+
- Docker (for `npm run dev` — Envio runs Postgres + Hasura locally)
- npm
- An **Envio API token** — required as of Envio v3 to use HyperSync. Free; grab one at <https://envio.dev/app/api-tokens>.

## First-time setup

```bash
cd back-end
cp .env.example .env
# Paste your ENVIO_API_TOKEN into .env
npm install
npm run codegen     # reads config.yaml + schema.graphql, generates typed bindings
npm run dev         # starts the indexer + Postgres + Hasura on :8080
```


Hasura's GraphQL endpoint will be available at <http://localhost:8080/v1/graphql>. The Hasura console is on <http://localhost:8080/console>.

When you edit `schema.graphql` or `config.yaml`, re-run `npm run codegen`.

## Day-to-day commands

```bash
npm run dev         # Start indexer + local stack (foreground)
npm run stop        # Tear down the local Docker stack
npm test            # Run any integration tests under test/
npm run codegen     # Re-run after schema or config changes
```

## Configuration

`config.yaml` is the source of truth:

- **Chain:** Base Sepolia (`84532`).
- **Contract:** `PredictionMarket` at `0x918E967932C90A841663562b501Ffb995430a028`.
- **Start block:** `41622000` — chosen safely before the earliest known market's creation block (`41622805`). The broadcast file from the deploy script reported a *later* block; always cross-check by looking at the on-chain `createdAt` of the earliest market before setting this. If `start_block` is later than any historical event, that event is silently missed.

To add another chain, append a new entry under `chains:` with its own `id`, `start_block`, and `address`. Re-run `npm run codegen` and restart `npm run dev`.

## Deploy

Two paths. **Hosted is recommended** for portfolio/educational projects — Envio manages the worker, Postgres, and the GraphQL endpoint, so the only thing you operate is the front-end.

### Hosted (recommended)

Envio v3 deploys are repo-based via the dashboard — there is no `envio deploy` CLI. The flow:

1. **Push to GitHub.** This repo already lives there; make sure `back-end/` is committed and pushed to `main` (or whichever branch you want hosted to track).
2. **Sign in** at <https://envio.dev/app> with the same account you used to mint your API token.
3. **Create a deployment** → "Deploy new indexer" → connect GitHub → select this repo → set the indexer root directory to `back-end`.
4. Envio's service clones the repo, runs `envio codegen` + `envio start`, and exposes a GraphQL endpoint at `https://indexer.dev.envio.dev/<deployment-slug>/v1/graphql`.
5. Wire the URL into the front-end:
   - Vercel → Settings → Environment Variables → set `NEXT_PUBLIC_INDEXER_URL` to the hosted URL.
   - Redeploy the front-end.
   - Stop the local indexer (`npm run stop`) — no longer needed.

Re-deploying on changes:

- Push to the tracked branch. Envio picks up the new commit, re-runs codegen, and starts the indexer.
- **Schema or `start_block` changes** trigger a full re-sync. First sync time depends on event density between `start_block` and head.
- **Handler-only changes** reuse the existing synced data — fast.

Watch progress, logs, and sync status in the Envio dashboard. The free tier comfortably covers small projects.

### Self-hosted (optional)

Only worth it for data-residency or cost-at-scale reasons. There's no official one-click chart yet — you write the `docker-compose.yml` yourself with the envio worker image + Postgres + Hasura, set `ENVIO_API_TOKEN` and your DB envs, and host it on Railway / Fly / Render / a VPS. More moving parts than hosted; no real benefit for this project.

### Pre-deploy checklist

- `back-end/.env` has `ENVIO_API_TOKEN` set.
- `back-end/.env` is git-ignored (already covered).
- `config.yaml` `start_block` is earlier than the earliest event you want to capture — verify against on-chain `createdAt` of the first market.
- `npm run codegen` is clean.
- Local `npm run dev` syncs without TUI errors (a React-duplication fix is pinned in `package.json` `overrides`).

## Front-end wiring

The front-end reads the indexer via `front-end/lib/indexer.ts`. Set:

```env
# Local dev:
NEXT_PUBLIC_INDEXER_URL=http://localhost:8080/v1/graphql
# Production (after hosted deploy):
NEXT_PUBLIC_INDEXER_URL=https://indexer.envio.dev/<project-id>/v1/graphql
```

If `NEXT_PUBLIC_INDEXER_URL` is **unset**, `use-markets` and `use-market-history` fall back to direct on-chain RPC reads — useful for offline development. When set, both hooks query the indexer.

## Operational notes

- **Reorgs:** `config.yaml` sets `rollback_on_reorg: true`. Envio tracks the last finalized block and re-indexes affected entities on reorg. No special handling in `EventHandlers.ts` is needed.
- **Idempotency:** Bet and Claim entity IDs are `txHash + "-" + logIndex`, so any replay of the same log overwrites the same row — safe.
- **Empty pools:** `yesProbabilityBps` defaults to `5000` (50%) for a fresh market with no bets, matching the front-end's display convention.
- **Outcome enum:** `0` = None, `1` = Yes, `2` = No — mirrors the Solidity `Outcome` enum.


## Adding a new event

1. Add the Solidity event signature to `config.yaml` under `events:` (must match the on-chain ABI exactly).
2. Add the entity to `schema.graphql` if it needs its own row, or update an existing one.
3. Add a handler in `src/EventHandlers.ts` using `indexer.onEvent({ contract: "PredictionMarket", event: "<EventName>" }, async ({ event, context }) => { ... })`.
4. `npm run codegen` to refresh types, then `npm run dev` to re-run.
