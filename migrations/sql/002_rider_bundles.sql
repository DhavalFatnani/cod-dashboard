-- 002_rider_bundles.sql
BEGIN;

CREATE TABLE IF NOT EXISTS rider_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL,
  sealed BOOLEAN NOT NULL DEFAULT false,
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
