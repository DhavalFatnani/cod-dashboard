-- 007_enums_and_state_changes.sql
BEGIN;

CREATE OR REPLACE FUNCTION update_order_money_state_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_version ON orders;
CREATE TRIGGER trg_orders_version BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_order_money_state_trigger();

COMMIT;
