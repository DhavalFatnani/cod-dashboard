-- 004_asm_superbundles.sql
BEGIN;

CREATE TABLE IF NOT EXISTS asm_superbundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asm_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asm_superbundle_bundles (
  superbundle_id UUID NOT NULL REFERENCES asm_superbundles(id) ON DELETE CASCADE,
  rider_bundle_id UUID NOT NULL REFERENCES rider_bundles(id) ON DELETE RESTRICT,
  PRIMARY KEY (superbundle_id, rider_bundle_id)
);

-- When a rider bundle is added to a superbundle, mark its orders as accepted_by_asm
CREATE OR REPLACE FUNCTION on_superbundle_bundle_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET money_state = 'accepted_by_asm'::money_state
  WHERE id IN (
    SELECT rbo.order_id FROM rider_bundle_orders rbo WHERE rbo.bundle_id = NEW.rider_bundle_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_superbundle_bundle_insert ON asm_superbundle_bundles;
CREATE TRIGGER trg_superbundle_bundle_insert
AFTER INSERT ON asm_superbundle_bundles
FOR EACH ROW EXECUTE FUNCTION on_superbundle_bundle_insert();

COMMIT;
