-- Add table representatives feature

create table if not exists table_representatives (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  table_no text not null,
  representative_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(room_id, table_no)
);

alter table table_representatives enable row level security;

-- Public read access for displaying representatives
create policy tr_public_read on table_representatives
  for select using (true);

-- Server-only write access
create policy tr_server_only_write on table_representatives
  for all using (false) with check (false);

comment on table table_representatives is 'Table representatives for quiz answer mode';

-- Add representatives field to room_snapshots for real-time display
alter table room_snapshots add column if not exists representatives jsonb default '[]'::jsonb;

comment on column room_snapshots.representatives is 'List of table representatives: [{"tableNo": "A", "name": "田中太郎"}, ...]';

-- Function to refresh representatives in snapshot
create or replace function refresh_room_representatives(p_room_id uuid)
returns void
language plpgsql
as $$
declare
  reps jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tableNo', table_no,
        'name', representative_name
      ) order by table_no
    ),
    '[]'::jsonb
  )
  into reps
  from table_representatives
  where room_id = p_room_id;

  insert into room_snapshots(room_id, representatives, updated_at)
  values (p_room_id, reps, now())
  on conflict (room_id)
  do update set representatives = excluded.representatives, updated_at = now();
end;
$$;

comment on function refresh_room_representatives is 'Refresh representatives list in room snapshot for real-time display';
