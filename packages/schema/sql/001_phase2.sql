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

alter table if exists players add column if not exists group_tag text;

alter table if exists room_snapshots enable row level security;
drop policy if exists rs_public_read on room_snapshots;
create policy rs_public_read on room_snapshots
  for select using (true);

alter table if exists room_admins enable row level security;
drop policy if exists ra_server_only on room_admins;
create policy ra_server_only on room_admins
  for all using (false) with check (false);

alter table if exists player_sessions enable row level security;
drop policy if exists ps_server_only on player_sessions;
create policy ps_server_only on player_sessions
  for all using (false) with check (false);

alter table if exists admin_audit_logs enable row level security;
drop policy if exists al_server_only on admin_audit_logs;
create policy al_server_only on admin_audit_logs
  for all using (false) with check (false);

alter table if exists awarded_quizzes enable row level security;
drop policy if exists aq_server_only on awarded_quizzes;
create policy aq_server_only on awarded_quizzes
  for all using (false) with check (false);

comment on table room_snapshots is 'Sanitized room state broadcast snapshots for realtime subscribers.';
comment on table room_admins is 'Per-room admin PIN hashes and flags.';
comment on table player_sessions is 'Participant session linking for device reconnects.';
comment on table admin_audit_logs is 'Operational audit log for admin actions.';

create or replace function refresh_room_leaderboard(p_room_id uuid, p_limit int default 20)
returns void
language plpgsql
as $$
declare
  entries jsonb;
begin
  with ranked_scores as (
    select
      s.player_id,
      s.total_points,
      p.display_name,
      row_number() over (order by s.total_points desc, s.last_update_at asc) as rank
    from scores s
    join players p on p.id = s.player_id
    where s.room_id = p_room_id
    order by s.total_points desc, s.last_update_at asc
    limit p_limit
  )
  select jsonb_agg(jsonb_build_object(
    'playerId', player_id,
    'name', display_name,
    'points', total_points,
    'rank', rank
  ) order by rank)
  into entries
  from ranked_scores;

  insert into room_snapshots(room_id, leaderboard, updated_at)
  values (p_room_id, coalesce(entries, '[]'::jsonb), now())
  on conflict (room_id)
  do update set leaderboard = coalesce(entries, '[]'::jsonb), updated_at = now();
end;
$$;

create or replace function apply_tap_delta(p_room_id uuid, p_player_id uuid, p_delta integer)
returns void
language plpgsql
as $$
declare
  clamped integer := greatest(1, least(30, p_delta));
begin
  insert into scores(room_id, player_id, total_points, last_update_at)
  values (p_room_id, p_player_id, clamped, now())
  on conflict (room_id, player_id)
  do update set total_points = scores.total_points + clamped, last_update_at = now();

  perform refresh_room_leaderboard(p_room_id);
end;
$$;

create or replace function record_quiz_answer(p_room_id uuid, p_quiz_id uuid, p_player_id uuid, p_choice integer)
returns void
language plpgsql
as $$
begin
  insert into answers(room_id, quiz_id, player_id, choice_index)
  values (p_room_id, p_quiz_id, p_player_id, p_choice)
  on conflict (quiz_id, player_id) do update set choice_index = excluded.choice_index;
end;
$$;

create or replace function draw_lottery(p_room_id uuid, p_kind text)
returns jsonb
language plpgsql
as $$
declare
  winner record;
  result jsonb;
begin
  if p_kind not in ('all', 'groom_friends', 'bride_friends') then
    raise exception 'Unsupported lottery kind %', p_kind;
  end if;

  if exists (select 1 from lottery_picks where room_id = p_room_id and kind = p_kind) then
    raise exception 'Lottery % already drawn', p_kind;
  end if;

  with candidates as (
    select p.id, p.display_name, p.table_no, p.seat_no
    from players p
    where p.room_id = p_room_id
      and coalesce(p.is_present, true)
      and (p_kind = 'all' or p.group_tag = p_kind)
      and not exists (select 1 from lottery_picks lp where lp.room_id = p_room_id and lp.player_id = p.id)
  )
  select id, display_name, table_no, seat_no into winner
  from candidates
  order by random()
  limit 1;

  if winner is null then
    raise exception 'No eligible players for lottery';
  end if;

  insert into lottery_picks(room_id, kind, player_id)
  values (p_room_id, p_kind, winner.id);

  result := jsonb_build_object(
    'kind', p_kind,
    'player', jsonb_build_object(
      'id', winner.id,
      'name', winner.display_name,
      'table_no', winner.table_no,
      'seat_no', winner.seat_no
    )
  );

  insert into room_snapshots(room_id, lottery_result, updated_at)
  values (p_room_id, result, now())
  on conflict (room_id)
  do update set lottery_result = excluded.lottery_result, updated_at = now();

  insert into admin_audit_logs(room_id, actor, action, payload, created_at)
  values (p_room_id, 'server', 'lottery:draw', result, now());

  return result;
end;
$$;

create or replace function reveal_quiz(p_room_id uuid, p_quiz_id uuid, p_points integer default 10)
returns jsonb
language plpgsql
as $$
declare
  quiz_data quizzes%rowtype;
  answer record;
  per_choice integer[] := array[0,0,0,0];
  awarded jsonb := '[]'::jsonb;
  result jsonb;
begin
  select * into quiz_data from quizzes where id = p_quiz_id and room_id = p_room_id;
  if quiz_data is null then
    raise exception 'Quiz % not found', p_quiz_id;
  end if;

  if exists (select 1 from awarded_quizzes where quiz_id = p_quiz_id) then
    raise exception 'Quiz already revealed';
  end if;

  for answer in
    select player_id, choice_index from answers where quiz_id = p_quiz_id
  loop
    per_choice[answer.choice_index + 1] := per_choice[answer.choice_index + 1] + 1;
    if answer.choice_index = quiz_data.answer_index then
      insert into scores(room_id, player_id, total_points, last_update_at)
      values (p_room_id, answer.player_id, p_points, now())
      on conflict (room_id, player_id)
      do update set total_points = scores.total_points + p_points, last_update_at = now();

      awarded := awarded || jsonb_build_object('playerId', answer.player_id, 'delta', p_points);
    end if;
  end loop;

  insert into awarded_quizzes(quiz_id, room_id, awarded_at)
  values (p_quiz_id, p_room_id, now());

  perform refresh_room_leaderboard(p_room_id);

  result := jsonb_build_object(
    'quizId', p_quiz_id,
    'correctIndex', quiz_data.answer_index,
    'perChoiceCounts', per_choice,
    'awarded', awarded
  );

  insert into room_snapshots(room_id, quiz_result, updated_at)
  values (p_room_id, result, now())
  on conflict (room_id)
  do update set quiz_result = excluded.quiz_result, updated_at = now();

  insert into admin_audit_logs(room_id, actor, action, payload, created_at)
  values (p_room_id, 'server', 'quiz:reveal', result, now());

  return result;
end;
$$;
