-- 005_depositbundles.sql
BEGIN;

CREATE TABLE IF NOT EXISTS deposit_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sm_id UUID NOT NULL,
  slip_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS depositbundle_superbundles (
  depositbundle_id UUID NOT NULL REFERENCES deposit_bundles(id) ON DELETE CASCADE,
  superbundle_id UUID NOT NULL REFERENCES asm_superbundles(id) ON DELETE RESTRICT,
  PRIMARY KEY (depositbundle_id, superbundle_id)
);

-- When superbundles are added to a deposit bundle, mark orders as in_depositbundle
CREATE OR REPLACE FUNCTION on_depositbundle_superbundle_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET money_state = 'in_depositbundle'::money_state
  WHERE id IN (
    SELECT rbo.order_id
    FROM asm_superbundle_bundles asb
    JOIN rider_bundle_orders rbo ON rbo.bundle_id = asb.rider_bundle_id
    WHERE asb.superbundle_id = NEW.superbundle_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_depositbundle_superbundle_insert ON depositbundle_superbundles;
CREATE TRIGGER trg_depositbundle_superbundle_insert
AFTER INSERT ON depositbundle_superbundles
FOR EACH ROW EXECUTE FUNCTION on_depositbundle_superbundle_insert();

COMMIT;
