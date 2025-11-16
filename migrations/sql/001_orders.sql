-- 001_orders.sql
-- Idempotent creation of orders table and related types
BEGIN;

CREATE TYPE IF NOT EXISTS money_state AS ENUM (
  'uncollected',
  'collected_unbundled',
  'bundled',
  'accepted_by_asm',
  'in_superbundle',
  'in_depositbundle',
  'deposited',
  'reconciled'
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT UNIQUE NOT NULL,
  rider_id UUID,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  money_state money_state NOT NULL DEFAULT 'uncollected',
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_money_state ON orders(money_state);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);

COMMIT;
