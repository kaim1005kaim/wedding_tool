-- Phase 2 schema extension

create table if not exists room_snapshots (
  room_id uuid primary key references rooms(id) on delete cascade,
  mode text not null default 'idle',
  phase text not null default 'idle',
  countdown_ms int default 0,
  leaderboard jsonb not null default '[]',
  current_quiz jsonb,
  quiz_result jsonb,
  lottery_result jsonb,
  updated_at timestamptz default now()
);

create table if not exists room_admins (
  room_id uuid primary key references rooms(id) on delete cascade,
  pin_hash text not null,
  disabled boolean default false,
  updated_at timestamptz default now()
);

create table if not exists player_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  device_fingerprint text,
  created_at timestamptz default now(),
  unique(room_id, player_id)
);

create table if not exists admin_audit_logs (
  id bigserial primary key,
  room_id uuid references rooms(id) on delete cascade,
  actor text not null,
  action text not null,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists awarded_quizzes (
  quiz_id uuid primary key references quizzes(id) on delete cascade,
  room_id uuid references rooms(id) on delete cascade,
  awarded_at timestamptz default now()
);

alter table if exists room_snapshots enable row level security;
create policy if not exists rs_public_read on room_snapshots
  for select using (true);

alter table if exists room_admins enable row level security;
create policy if not exists ra_server_only on room_admins
  for all using (false) with check (false);

alter table if exists player_sessions enable row level security;
create policy if not exists ps_server_only on player_sessions
  for all using (false) with check (false);

alter table if exists admin_audit_logs enable row level security;
create policy if not exists al_server_only on admin_audit_logs
  for all using (false) with check (false);

alter table if exists awarded_quizzes enable row level security;
create policy if not exists aq_server_only on awarded_quizzes
  for all using (false) with check (false);

comment on table room_snapshots is 'Sanitized room state broadcast snapshots for realtime subscribers.';
comment on table room_admins is 'Per-room admin PIN hashes and flags.';
comment on table player_sessions is 'Participant session linking for device reconnects.';
comment on table admin_audit_logs is 'Operational audit log for admin actions.';
