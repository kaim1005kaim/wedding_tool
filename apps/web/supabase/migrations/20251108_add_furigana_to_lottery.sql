-- Update lottery draw function to include furigana
create or replace function draw_lottery(p_room_id uuid, p_kind text)
returns jsonb
language plpgsql
as $$
declare
  winner record;
  result jsonb;
begin
  if exists (select 1 from lottery_picks where room_id = p_room_id and kind = p_kind) then
    raise exception 'Lottery % already drawn', p_kind;
  end if;

  with candidates as (
    select p.id, p.display_name, p.furigana, p.table_no, p.seat_no
    from players p
    where p.room_id = p_room_id
      and coalesce(p.is_present, true)
      and not exists (select 1 from lottery_picks lp where lp.room_id = p_room_id and lp.player_id = p.id)
      and (p_kind = 'all' or p.group_tag = p_kind)
  )
  select id, display_name, furigana, table_no, seat_no into winner
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
      'furigana', winner.furigana,
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
