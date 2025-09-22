create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  mode text not null default 'idle',
  phase text not null default 'idle',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  display_name text not null,
  table_no text,
  seat_no text,
  is_present boolean default true,
  created_at timestamptz default now()
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  total_points int not null default 0,
  last_update_at timestamptz default now(),
  unique(room_id, player_id)
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  question text not null,
  choices text[] not null check (array_length(choices, 1) = 4),
  answer_index int not null check (answer_index between 0 and 3),
  ord int not null
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  choice_index int not null check (choice_index between 0 and 3),
  created_at timestamptz default now(),
  unique(quiz_id, player_id)
);

create table if not exists lottery_picks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  kind text not null,
  player_id uuid references players(id),
  created_at timestamptz default now(),
  unique(room_id, kind)
);

alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table lottery_picks;
