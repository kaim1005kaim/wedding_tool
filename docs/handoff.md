# Phase 2 Handoff Notes

## Done in this Iteration
- Added **RoomEngine** (`apps/web/lib/server/room-engine.ts`) as the single authority for count-up, quiz, and lottery operations. Every API route now updates Postgres tables, `room_snapshots`, and `admin_audit_logs` in one place.
- Expanded Supabase schema (`packages/schema/sql/001_phase2.sql`) with `room_snapshots.quiz_result`, `awarded_quizzes`, and a `(room_id, kind)` unique constraint for `lottery_picks`.
- Reworked cloud APIs with JWT + zod validation:
  - Admin routes for mode/game control, quiz show/next/reveal, lottery draw, and audit-log retrieval.
  - Player routes for join/tap/quiz-answer with rate limiting and delta clamping.
- Updated realtime client / Zustand store so UI relies solely on `room_snapshots` (cloud vs. LAN is switched automatically).
- Built cloud-ready admin & join screens: JWT login, audit/lottery panels, REST fallbacks; LAN mode still uses Socket.IO.
- Completed `infra/supabase/seed.mjs` to provision a TEST room, PIN, demo players/quizzes, and initial snapshots.
- Introduced minimal Sentry setup (client & server configs, `next.config.mjs` integration) – enable via `NEXT_PUBLIC_SENTRY_DSN`.
- Verified `pnpm -C apps/web build` succeeds after changes.

## Outstanding Before Phase 2 Acceptance
1. **RoomEngine hardening**
   - Wrap operations in Supabase Postgres functions or otherwise ensure transactional safety.
   - Finalize quiz reveal logic (idempotency, awarded flag) and integrate projector animations.
2. **Full testing**
   - Implement Vitest coverage for tap rate limiting / quiz reveal / lottery selection.
   - Add Playwright scenarios (count-up, quiz, lottery) and wire into CI (GitHub Actions).
3. **Security & operations**
   - Double-check RLS so anon key can only read `room_snapshots`.
   - Add Sentry breadcrumbs for admin actions (mode, start/stop, quiz, lottery).
   - Document and rehearse LAN fallback runbook.
4. **UX polish**
   - Projector visual enhancements (quiz distribution, winner callout).
   - Admin helpers (quiz selection, countdown adjustment) as needed.

## How to Continue
1. **Seed / Reset Demo Data**
   ```bash
   pnpm install
   pnpm migrate
   pnpm seed # creates TEST room, PIN=1234, demo data
   ```
2. **Run locally (cloud mode)**
   - Provide Supabase env vars + `APP_JWT_SECRET` in `.env`.
   - `pnpm dev` for Next.js, or `pnpm build && pnpm start`.
3. **LAN fallback**
   - Set `NEXT_PUBLIC_MODE=lan`, then `pnpm dev:lan` (Node 20).
4. **Testing placeholders**
   - Unit/E2E scripts not yet wired; add to `apps/web/package.json` before enabling CI.

## Key Env Vars
- `APP_JWT_SECRET` – HMAC secret for admin/player tokens.
- `ADMIN_PIN_SEED` – Optional helper for generating initial PIN hashes.
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Optional: `NEXT_PUBLIC_SENTRY_DSN`, `SEED_ROOM_CODE`, `SEED_ADMIN_PIN`.

## Quick File Map
- `apps/web/lib/server/room-engine.ts` – shared authority logic.
- `apps/web/app/api/...` – cloud REST endpoints.
- `apps/web/components/admin-room.tsx` / `join-room.tsx` – updated UIs.
- `infra/supabase/seed.mjs` – demo seeding.
- `packages/rt-adapter/src/index.ts` – snapshot-aware realtime adapter.

> NOTE: Stick to Node 20 + pnpm 9.x (`package.json` enforces it). Build step uses Sentry's webpack plugin, so ensure `SENTRY_AUTH_TOKEN` is configured in CI before enabling source upload.
