-- Migration 041: Add bundle feature flags
-- Creates feature flags for gradual rollout of bundle functionality

-- Insert feature flags (idempotent)
INSERT INTO public.feature_flags (flag_key, flag_value, description)
VALUES
  (
    'rider_bundles_enabled',
    '{"enabled": false}'::jsonb,
    'Enable rider bundle creation functionality'
  ),
  (
    'bundle_enforcement_required',
    '{"enabled": false}'::jsonb,
    'Require bundling before handover (enforces bundle workflow)'
  ),
  (
    'asm_superbundles_enabled',
    '{"enabled": false}'::jsonb,
    'Enable ASM superbundle creation functionality'
  ),
  (
    'enable_retrospective_bundles',
    '{"enabled": false}'::jsonb,
    'Enable retrospective bundle creation for existing orders'
  )
ON CONFLICT (flag_key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();

-- Add comments
COMMENT ON TABLE public.feature_flags IS 'Feature flags for controlling bundle functionality rollout';
