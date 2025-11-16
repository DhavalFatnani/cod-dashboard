-- Dry run: BEGIN and ROLLBACK
BEGIN;
\ir ../sql/001_orders.sql
\ir ../sql/002_rider_bundles.sql
\ir ../sql/003_rider_bundle_orders.sql
\ir ../sql/004_asm_superbundles.sql
\ir ../sql/005_depositbundles.sql
\ir ../sql/006_audit_tables.sql
\ir ../sql/007_enums_and_state_changes.sql
\ir ../sql/008_rls_policies.sql
ROLLBACK;
