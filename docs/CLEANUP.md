# Data Cleanup Procedures

## Test Data Cleanup

### Using Simulator UI

1. Navigate to Simulator page (Admin only)
2. Click "Cleanup Test Data" button
3. Confirm deletion
4. All test data with the current `test_tag` will be deleted

### Using API

```bash
curl -X POST https://your-project.supabase.co/functions/v1/simulator/cleanup \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"test_tag": "test-1234567890"}'
```

### Using SQL

```sql
-- Delete test orders and related data
DELETE FROM rider_events
WHERE order_id IN (
  SELECT id FROM orders WHERE is_test = true AND test_tag = 'test-1234567890'
);

DELETE FROM asm_events
WHERE order_id IN (
  SELECT id FROM orders WHERE is_test = true AND test_tag = 'test-1234567890'
);

DELETE FROM deposit_orders
WHERE order_id IN (
  SELECT id FROM orders WHERE is_test = true AND test_tag = 'test-1234567890'
);

DELETE FROM orders
WHERE is_test = true AND test_tag = 'test-1234567890';

-- Delete test deposits
DELETE FROM deposit_orders
WHERE deposit_id IN (
  SELECT id FROM deposits WHERE metadata->>'test_tag' = 'test-1234567890'
);

DELETE FROM deposits
WHERE metadata->>'test_tag' = 'test-1234567890';
```

## Bulk Cleanup by Date

```sql
-- Delete all test orders older than 7 days
DELETE FROM rider_events
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE is_test = true 
  AND created_at < NOW() - INTERVAL '7 days'
);

DELETE FROM asm_events
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE is_test = true 
  AND created_at < NOW() - INTERVAL '7 days'
);

DELETE FROM deposit_orders
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE is_test = true 
  AND created_at < NOW() - INTERVAL '7 days'
);

DELETE FROM orders
WHERE is_test = true 
AND created_at < NOW() - INTERVAL '7 days';
```

## Cleanup All Test Data

⚠️ **Warning**: This deletes ALL test data.

```sql
-- Delete all test orders
DELETE FROM rider_events
WHERE order_id IN (SELECT id FROM orders WHERE is_test = true);

DELETE FROM asm_events
WHERE order_id IN (SELECT id FROM orders WHERE is_test = true);

DELETE FROM deposit_orders
WHERE order_id IN (SELECT id FROM orders WHERE is_test = true);

DELETE FROM orders WHERE is_test = true;

-- Delete test deposits
DELETE FROM deposit_orders
WHERE deposit_id IN (
  SELECT id FROM deposits WHERE metadata->>'test_tag' IS NOT NULL
);

DELETE FROM deposits
WHERE metadata->>'test_tag' IS NOT NULL;
```

## Audit Log Cleanup

```sql
-- Delete audit logs older than 90 days
DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Or keep only last 1000 entries per resource type
DELETE FROM audit_logs
WHERE id NOT IN (
  SELECT id FROM audit_logs
  ORDER BY created_at DESC
  LIMIT 1000
);
```

## Safe Cleanup Script

Create a script to safely cleanup test data:

```typescript
// scripts/cleanup-test-data.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function cleanupTestData(testTag?: string) {
  console.log('Starting cleanup...')
  
  // Get test orders
  let query = supabase
    .from('orders')
    .select('id')
    .eq('is_test', true)
  
  if (testTag) {
    query = query.eq('test_tag', testTag)
  }
  
  const { data: orders } = await query
  
  if (!orders || orders.length === 0) {
    console.log('No test orders found')
    return
  }
  
  const orderIds = orders.map(o => o.id)
  
  // Delete related records
  await supabase.from('rider_events').delete().in('order_id', orderIds)
  await supabase.from('asm_events').delete().in('order_id', orderIds)
  await supabase.from('deposit_orders').delete().in('order_id', orderIds)
  
  // Delete orders
  await supabase.from('orders').delete().in('id', orderIds)
  
  console.log(`Deleted ${orders.length} test orders`)
}

// Run cleanup
cleanupTestData(process.argv[2])
```

Run:
```bash
ts-node scripts/cleanup-test-data.ts [test_tag]
```

## Verification

After cleanup, verify:

```sql
-- Check remaining test orders
SELECT COUNT(*) FROM orders WHERE is_test = true;

-- Check for orphaned events
SELECT COUNT(*) FROM rider_events re
LEFT JOIN orders o ON re.order_id = o.id
WHERE o.id IS NULL;

SELECT COUNT(*) FROM asm_events ae
LEFT JOIN orders o ON ae.order_id = o.id
WHERE o.id IS NULL;
```

## Best Practices

1. **Always backup** before bulk deletions
2. **Use transactions** for multi-step cleanup
3. **Test cleanup** on staging first
4. **Keep audit logs** for compliance
5. **Schedule cleanup** jobs (cron) for old test data
6. **Tag test data** with `test_tag` for easy identification

## Automated Cleanup

Set up a cron job or scheduled function:

```sql
-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_test_data()
RETURNS void AS $$
BEGIN
  DELETE FROM rider_events
  WHERE order_id IN (
    SELECT id FROM orders 
    WHERE is_test = true 
    AND created_at < NOW() - INTERVAL '7 days'
  );
  
  DELETE FROM asm_events
  WHERE order_id IN (
    SELECT id FROM orders 
    WHERE is_test = true 
    AND created_at < NOW() - INTERVAL '7 days'
  );
  
  DELETE FROM deposit_orders
  WHERE order_id IN (
    SELECT id FROM orders 
    WHERE is_test = true 
    AND created_at < NOW() - INTERVAL '7 days'
  );
  
  DELETE FROM orders
  WHERE is_test = true 
  AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available)
SELECT cron.schedule(
  'cleanup-test-data',
  '0 2 * * *', -- Daily at 2 AM
  $$SELECT cleanup_old_test_data()$$
);
```

