# wedding_tool realtime platform

Monorepo for the wedding_tool realtime game platform. The project provides both a cloud deployment path (Supabase + Next.js on Vercel) and a fully offline LAN mode powered by Socket.IO.

## Repository Layout

- `apps/web` – Next.js 14 application serving join, admin, and projector experiences.
- `apps/lan-server` – Socket.IO realtime server for offline fallback.
- `packages/rt-adapter` – Shared realtime abstraction with Supabase & Socket.IO implementations.
- `packages/schema` – Database schema (SQL) and zod validators for events/payloads.
- `packages/ui` – Shared UI primitives (buttons, leaderboard, etc.).
- `infra/` – Supabase assets, load-testing scenarios, optional Docker configs.
- `tests/` – Vitest unit tests and Playwright E2E scaffolding.

## Getting Started

```bash
pnpm install
cp .env.example .env
```

### Cloud mode (Supabase)

1. Fill Supabase URL/keys and shared admin PIN in `.env`.
2. Run the web app: `pnpm dev`
3. Apply schema: `pnpm migrate`
4. Seed demo data (optional): `pnpm seed`

### LAN fallback mode

```bash
NEXT_PUBLIC_MODE=lan pnpm dev:lan
```

This launches the Socket.IO server on port 5050 and Next.js on port 3000. Distribute the LAN URL (e.g. `http://weddingtool.local:3000/join/ABCD`).

## Tooling

- **Vitest** unit tests – `pnpm test`
- **Playwright** E2E suite – `pnpm e2e`
- **Artillery** load test – `pnpm load`

## Supabase Schema

The canonical schema lives in `packages/schema/sql/000_init.sql`. Changes should be reflected there and pushed with `pnpm migrate`.

## Next Steps

- Implement API route handlers in `apps/web` to persist events and broadcast via Supabase.
- Expand Playwright tests to simulate 10/30/70 participant scenarios per the spec.
- Integrate Sentry and production observability before the wedding day dry-run.
