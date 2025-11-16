-- 008_rls_policies.sql
BEGIN;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_bundle_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_superbundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE asm_superbundle_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositbundle_superbundles ENABLE ROW LEVEL SECURITY;

-- Example simplistic policies (to be refined per role)
DROP POLICY IF EXISTS orders_select_all ON orders;
CREATE POLICY orders_select_all ON orders FOR SELECT USING (true);

-- Immutability once deposited
CREATE OR REPLACE FUNCTION prevent_update_if_deposited()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.money_state = 'deposited'::money_state THEN
    RAISE EXCEPTION 'Cannot modify deposited orders';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_immutable_after_deposit ON orders;
CREATE TRIGGER trg_orders_immutable_after_deposit BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION prevent_update_if_deposited();

COMMIT;
