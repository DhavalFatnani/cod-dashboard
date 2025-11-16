-- Rollback best-effort (non-destructive schema only)
BEGIN;
DROP TRIGGER IF EXISTS trg_depositbundle_superbundle_insert ON depositbundle_superbundles;
DROP FUNCTION IF EXISTS on_depositbundle_superbundle_insert;
DROP TABLE IF EXISTS depositbundle_superbundles;
DROP TABLE IF EXISTS deposit_bundles;

DROP TRIGGER IF EXISTS trg_superbundle_bundle_insert ON asm_superbundle_bundles;
DROP FUNCTION IF EXISTS on_superbundle_bundle_insert;
DROP TABLE IF EXISTS asm_superbundle_bundles;
DROP TABLE IF EXISTS asm_superbundles;

DROP TRIGGER IF EXISTS trg_rider_bundle_order_insert ON rider_bundle_orders;
DROP FUNCTION IF EXISTS on_rider_bundle_order_insert;
DROP TABLE IF EXISTS rider_bundle_orders;
DROP TABLE IF EXISTS rider_bundles;

DROP TRIGGER IF EXISTS trg_orders_version ON orders;
DROP FUNCTION IF EXISTS update_order_money_state_trigger;
DROP TABLE IF EXISTS orders;
DROP TYPE IF EXISTS money_state;

DROP TABLE IF EXISTS audit_events;
COMMIT;
