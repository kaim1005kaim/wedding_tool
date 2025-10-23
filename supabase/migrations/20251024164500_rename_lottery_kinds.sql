-- Rename lottery kind values from groom_friends/bride_friends to groom/bride
-- Update players table group_tag
UPDATE players
SET group_tag = 'groom'
WHERE group_tag = 'groom_friends';

UPDATE players
SET group_tag = 'bride'
WHERE group_tag = 'bride_friends';

-- Update lottery_candidates table group_tag
UPDATE lottery_candidates
SET group_tag = 'groom'
WHERE group_tag = 'groom_friends';

UPDATE lottery_candidates
SET group_tag = 'bride'
WHERE group_tag = 'bride_friends';

-- Update audit_log table for lottery draws
UPDATE audit_log
SET payload = jsonb_set(payload, '{kind}', '"groom"'::jsonb)
WHERE action = 'lottery:draw' AND payload->>'kind' = 'groom_friends';

UPDATE audit_log
SET payload = jsonb_set(payload, '{kind}', '"bride"'::jsonb)
WHERE action = 'lottery:draw' AND payload->>'kind' = 'bride_friends';
