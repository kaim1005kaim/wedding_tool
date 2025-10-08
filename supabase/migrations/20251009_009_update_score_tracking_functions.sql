-- Update refresh_room_leaderboard to include quiz_points and countup_tap_count
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
      s.quiz_points,
      s.countup_tap_count,
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
    'quizPoints', quiz_points,
    'countupTapCount', countup_tap_count,
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

-- Update apply_tap_delta to track countup_tap_count
create or replace function apply_tap_delta(p_room_id uuid, p_player_id uuid, p_delta integer)
returns void
language plpgsql
as $$
declare
  clamped integer := greatest(1, least(30, p_delta));
begin
  insert into scores(room_id, player_id, total_points, countup_tap_count, last_update_at)
  values (p_room_id, p_player_id, clamped, clamped, now())
  on conflict (room_id, player_id)
  do update set
    total_points = scores.total_points + clamped,
    countup_tap_count = scores.countup_tap_count + clamped,
    last_update_at = now();

  perform refresh_room_leaderboard(p_room_id);
end;
$$;

-- Update reveal_quiz to track quiz_points
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
      insert into scores(room_id, player_id, total_points, quiz_points, last_update_at)
      values (p_room_id, answer.player_id, p_points, 1, now())
      on conflict (room_id, player_id)
      do update set
        total_points = scores.total_points + p_points,
        quiz_points = scores.quiz_points + 1,
        last_update_at = now();

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

  return result;
end;
$$;
