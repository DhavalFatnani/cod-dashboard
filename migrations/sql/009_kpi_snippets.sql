-- 009_kpi_snippets.sql
-- Example KPI queries (snippets)
-- Pending bundles count
-- SELECT COUNT(*) FROM rider_bundles WHERE sealed = false;

-- Unbundled amounts
-- SELECT COALESCE(SUM(amount_cents),0) FROM orders WHERE money_state IN ('uncollected','collected_unbundled');

-- Expected vs actual at deposit bundle
-- SELECT db.id, SUM(o.amount_cents) AS expected
-- FROM deposit_bundles db
-- JOIN depositbundle_superbundles ds ON ds.depositbundle_id = db.id
-- JOIN asm_superbundle_bundles asb ON asb.superbundle_id = ds.superbundle_id
-- JOIN rider_bundle_orders rbo ON rbo.bundle_id = asb.rider_bundle_id
-- JOIN orders o ON o.id = rbo.order_id
-- GROUP BY db.id;
