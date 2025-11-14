-- Reset simulator status to stopped
-- Run this in Supabase Studio SQL Editor

UPDATE feature_flags
SET flag_value = jsonb_build_object(
  'running', false,
  'test_tag', null
)
WHERE flag_key = 'simulator_status';

-- If the flag doesn't exist, insert it
INSERT INTO feature_flags (flag_key, flag_value)
VALUES (
  'simulator_status',
  jsonb_build_object(
    'running', false,
    'test_tag', null
  )
)
ON CONFLICT (flag_key) DO UPDATE
SET flag_value = jsonb_build_object(
  'running', false,
  'test_tag', null
);

-- Verify the update
SELECT * FROM feature_flags WHERE flag_key = 'simulator_status';

