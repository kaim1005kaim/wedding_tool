-- Buzzer quiz reveal function: only fastest correct answer wins

create or replace function reveal_buzzer_quiz(p_room_id uuid, p_quiz_id uuid, p_points integer default 10)
returns jsonb
language plpgsql
as $$
declare
  quiz_data quizzes%rowtype;
  answer record;
  per_choice integer[] := array[0,0,0,0];
  fastest_winner_id uuid := null;
  fastest_answered_at timestamptz := null;
  awarded jsonb := '[]'::jsonb;
  result jsonb;
begin
  select * into quiz_data from quizzes where id = p_quiz_id;
  if quiz_data is null then
    raise exception 'Quiz % not found', p_quiz_id;
  end if;

  if exists (select 1 from awarded_quizzes where quiz_id = p_quiz_id) then
    raise exception 'Quiz already revealed';
  end if;

  -- Find fastest correct answer
  select player_id, answered_at into fastest_winner_id, fastest_answered_at
  from answers
  where quiz_id = p_quiz_id
    and choice_index = quiz_data.answer_index
  order by answered_at asc
  limit 1;

  -- Count all answers by choice
  for answer in
    select player_id, choice_index from answers where quiz_id = p_quiz_id
  loop
    per_choice[answer.choice_index + 1] := per_choice[answer.choice_index + 1] + 1;
  end loop;

  -- Award points only to fastest correct player
  if fastest_winner_id is not null then
    insert into scores(room_id, player_id, total_points, quiz_points, last_update_at)
    values (p_room_id, fastest_winner_id, p_points, 1, now())
    on conflict (room_id, player_id)
    do update set
      total_points = scores.total_points + p_points,
      quiz_points = scores.quiz_points + 1,
      last_update_at = now();

    awarded := awarded || jsonb_build_object('playerId', fastest_winner_id, 'delta', p_points, 'answeredAt', fastest_answered_at);
  end if;

  insert into awarded_quizzes(quiz_id, room_id, awarded_at)
  values (p_quiz_id, p_room_id, now());

  perform refresh_room_leaderboard(p_room_id);

  result := jsonb_build_object(
    'quizId', p_quiz_id,
    'correctIndex', quiz_data.answer_index,
    'perChoiceCounts', per_choice,
    'awarded', awarded,
    'winnerId', fastest_winner_id,
    'isBuzzerMode', true
  );

  return result;
end;
$$;

COMMENT ON FUNCTION reveal_buzzer_quiz IS 'Reveal buzzer quiz answer and award points only to the fastest correct player';
