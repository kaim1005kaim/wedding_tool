# wedding_tool realtime platform

Monorepo for the wedding reception realtime platform. The system runs in cloud mode (Supabase + Next.js on Vercel) or an offline LAN fallback powered by Socket.IO. The cloud stack now supports:

- Admin login via PIN with JWT authentication (`/admin` → room code → `/admin/{roomId}`)
- Player onboarding by room code (`/join/{CODE}`) with Supabase-backed state
- Real-time propagation of room snapshots through Supabase Realtime publications

## Repository Layout

- `apps/web` – Next.js 14 application serving join, admin, and projector experiences.
- `apps/lan-server` – Socket.IO realtime server for offline fallback mode.
- `packages/rt-adapter` – Shared realtime abstraction with Supabase & Socket.IO implementations.
- `packages/schema` – Database schema (SQL) and Zod validators for events/payloads.
- `packages/ui` – Shared UI primitives (buttons, leaderboard, etc.).
- `infra/` – Supabase assets, load-testing scenarios, optional Docker configs.
- `supabase/migrations` – SQL migrations (e.g. enabling realtime publications).
- `tests/` – Vitest unit tests and Playwright E2E scaffolding.

## Prerequisites

- Node.js 20
- pnpm 9
- Supabase project (for cloud mode)
- Optional: Vercel project for deployment

## Environment Variables

Create `.env` (cloud mode) and populate the following keys. The same values should be configured in Vercel for production deployments.

| Key | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-side access) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `APP_JWT_SECRET` | HMAC secret used for admin/player JWTs |
| `ADMIN_SHARED_PASSCODE` | Optional fallback PIN for admin login (e.g. `1234`) |
| `SEED_ROOM_CODE` / `SEED_ADMIN_PIN` | Optional overrides for the seeding script |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional Sentry DSN to enable monitoring |

## Setup & Local Development

```bash
pnpm install
cp .env.example .env
# Edit .env with the values listed above

# Apply all SQL migrations (includes realtime publication setup)
pnpm migrate

# Optionally seed demo data (room TEST, PIN 1234)
pnpm seed

# Start Next.js in cloud mode
pnpm dev
```

### Cloud Workflow Highlights

- Access admin console: open `http://localhost:3000/admin`, enter a room code (e.g. `TEST`), then log in with the room PIN.
- Player join screen: `http://localhost:3000/join/TEST` – players enter name/table/seat and receive an auth token tied to the Supabase room ID.
- Real-time updates: `supabase/migrations/002_enable_realtime.sql` ensures `room_snapshots` changes broadcast via Supabase Realtime, so mode switches, quizzes, etc. propagate instantly to connected clients.

### LAN fallback mode

```bash
NEXT_PUBLIC_MODE=lan pnpm dev:lan
```

This launches the Socket.IO server on port 5050 and Next.js on port 3000. Share the LAN URL (e.g. `http://weddingtool.local:3000/join/ABCD`). Admin actions will go through the LAN server instead of Supabase.

## Testing & Tooling

- **Vitest** unit tests – `pnpm test`
- **Playwright** E2E suite – `pnpm e2e` (wire up to CI when scenarios are ready)
- **Artillery** load test – `pnpm load`

## Database & Realtime Notes

- Canonical schema lives in `packages/schema/sql`. Run `pnpm migrate` whenever SQL changes (includes `001_phase2.sql` and `002_enable_realtime.sql`).
- If you add new tables that should broadcast via Supabase Realtime, update `002_enable_realtime.sql` (or a new migration) with `ALTER PUBLICATION supabase_realtime ADD TABLE <table>;`.

## Deployment Checklist

1. Ensure all environment variables are set in Vercel (and redeploy after changes).
2. Run `pnpm migrate` against the Supabase production database.
3. (Optional) Run `pnpm seed` in a safe environment to refresh demo data.
4. Verify admin login and player join flows in the deployed environment (`/admin`, `/join/{CODE}`).

## Roadmap / Next Steps

- Expand automated coverage: Vitest around join/tap rate limits and Supabase RPC calls; Playwright scenarios for count-up/quiz/lottery.
- Add projector polish and admin UX helpers (quiz selection, countdown adjustment).
- Harden LAN fallback operations and document the runbook for the wedding-day handoff.
