-- Add quiz_points and countup_tap_count columns to scores table
alter table scores
  add column if not exists quiz_points int not null default 0,
  add column if not exists countup_tap_count int not null default 0;
