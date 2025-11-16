-- 003_rider_bundle_orders.sql
BEGIN;

CREATE TABLE IF NOT EXISTS rider_bundle_orders (
  bundle_id UUID NOT NULL REFERENCES rider_bundles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  PRIMARY KEY (bundle_id, order_id)
);

-- When an order is added to a rider bundle, move it to 'bundled'
CREATE OR REPLACE FUNCTION on_rider_bundle_order_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders SET money_state = 'bundled'::money_state WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rider_bundle_order_insert ON rider_bundle_orders;
CREATE TRIGGER trg_rider_bundle_order_insert
AFTER INSERT ON rider_bundle_orders
FOR EACH ROW EXECUTE FUNCTION on_rider_bundle_order_insert();

COMMIT;
