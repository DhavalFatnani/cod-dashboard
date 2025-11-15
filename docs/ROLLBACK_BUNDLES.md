# Rollback Procedure for Rider Bundles & ASM SuperBundles

This document outlines the procedure to rollback the bundle system if critical issues are found in production.

## Prerequisites

- Database backup taken before rollback
- Access to Supabase dashboard or database
- Feature flags table access
- All team members notified

## Rollback Steps

### Step 1: Disable Feature Flags

Disable all bundle-related feature flags to prevent new bundle operations:

```sql
UPDATE feature_flags
SET flag_value = '{"enabled": false}',
    updated_at = NOW()
WHERE flag_key IN (
  'rider_bundles_enabled',
  'bundle_enforcement_required',
  'asm_superbundles_enabled',
  'enable_retrospective_bundles'
);
```

### Step 2: Revert Order States

Revert order states from bundle-related states back to COLLECTED_BY_RIDER:

```sql
-- Revert BUNDLED orders
UPDATE orders
SET 
  money_state = 'COLLECTED_BY_RIDER',
  bundle_id = NULL,
  updated_at = NOW()
WHERE money_state = 'BUNDLED'
  AND bundle_id IS NOT NULL;

-- Revert READY_FOR_HANDOVER orders (if any)
UPDATE orders
SET 
  money_state = 'COLLECTED_BY_RIDER',
  bundle_id = NULL,
  updated_at = NOW()
WHERE money_state = 'BUNDLED'
  AND bundle_id IN (
    SELECT id FROM rider_bundles WHERE status = 'READY_FOR_HANDOVER'
  );

-- Revert INCLUDED_IN_SUPERBUNDLE orders
UPDATE orders
SET 
  money_state = 'HANDOVER_TO_ASM',
  bundle_id = NULL,
  updated_at = NOW()
WHERE money_state = 'INCLUDED_IN_SUPERBUNDLE';
```

### Step 3: Archive Bundle Records

Archive bundle records instead of deleting them (for audit trail):

```sql
-- Add archived_at timestamp if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rider_bundles' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE rider_bundles ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;
END $$;

-- Archive all bundles
UPDATE rider_bundles
SET archived_at = NOW()
WHERE archived_at IS NULL;

-- Archive superbundles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'asm_superbundles' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE asm_superbundles ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;
END $$;

UPDATE asm_superbundles
SET archived_at = NOW()
WHERE archived_at IS NULL;
```

### Step 4: Remove Bundle Links from Orders

Remove bundle_id references from orders:

```sql
UPDATE orders
SET 
  bundle_id = NULL,
  updated_at = NOW()
WHERE bundle_id IS NOT NULL;
```

### Step 5: Restore Legacy Deposit Flow

Ensure legacy deposit flow (order_ids) is working:

- Verify `asm-deposit` edge function accepts `order_ids` parameter
- Test deposit creation with order_ids
- Verify orders transition to DEPOSITED state correctly

### Step 6: Update Frontend

If needed, rollback frontend to previous version:

```bash
# Revert to previous git commit
git checkout <previous-commit-hash>

# Or disable bundle features via feature flags in frontend
# Update feature flag checks to hide bundle UI
```

### Step 7: Notify Users

Send notification to all users:

- In-app banner: "Bundle system temporarily disabled. Please use legacy deposit flow."
- Email/Slack notification to ASMs and Riders
- Update user documentation

## Verification Queries

Run these queries to verify rollback was successful:

```sql
-- Check no orders are in bundle states
SELECT money_state, COUNT(*) 
FROM orders 
WHERE money_state IN ('BUNDLED', 'INCLUDED_IN_SUPERBUNDLE')
GROUP BY money_state;
-- Should return 0 rows

-- Check all bundles are archived
SELECT COUNT(*) as active_bundles
FROM rider_bundles
WHERE archived_at IS NULL;
-- Should return 0

-- Check feature flags are disabled
SELECT flag_key, flag_value->>'enabled' as enabled
FROM feature_flags
WHERE flag_key LIKE '%bundle%';
-- All should show 'false'

-- Check orders can be deposited via legacy flow
SELECT COUNT(*) as ready_for_deposit
FROM orders
WHERE money_state = 'HANDOVER_TO_ASM'
  AND payment_type = 'COD'
  AND cod_type = 'COD_HARD';
-- Should show orders ready for deposit
```

## Data Recovery

If data needs to be recovered:

1. **Restore from backup**: Use database backup taken before bundle system
2. **Manual reconciliation**: Use audit logs to reconcile bundle amounts with orders
3. **Export bundle data**: Export bundle records before archiving for later analysis

## Post-Rollback Monitoring

Monitor for 24-48 hours after rollback:

- Order state transitions
- Deposit creation success rate
- Error rates in edge functions
- User complaints/issues

## Re-enabling Bundles (After Fixes)

If bundles need to be re-enabled after fixes:

1. Fix identified issues
2. Test in staging environment
3. Re-enable feature flags gradually:
   ```sql
   UPDATE feature_flags
   SET flag_value = '{"enabled": true}',
       updated_at = NOW()
   WHERE flag_key = 'rider_bundles_enabled';
   ```
4. Monitor closely
5. Gradually enable other flags

## Emergency Contacts

- Database Admin: [Contact]
- Backend Team Lead: [Contact]
- Frontend Team Lead: [Contact]
- On-call Engineer: [Contact]

## Notes

- **DO NOT DELETE** bundle records - always archive
- Keep audit logs for at least 90 days
- Document any manual interventions
- Update this document with lessons learned
