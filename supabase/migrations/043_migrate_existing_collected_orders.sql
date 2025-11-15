-- Migration 043: Migrate existing collected orders without bundle_id
-- This migration handles existing orders in COLLECTED_BY_RIDER state that don't have a bundle_id
-- Strategy: Mark as legacy orders (bundle_id = NULL, add legacy flag) and require manual bundling

-- Add legacy flag to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'is_legacy_unbundled'
  ) THEN
    ALTER TABLE orders ADD COLUMN is_legacy_unbundled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Dry-run mode: Preview affected orders
-- Uncomment and run this query first to see what will be affected:
/*
SELECT 
  COUNT(*) as total_affected,
  SUM(cod_amount) as total_amount,
  COUNT(DISTINCT rider_id) as unique_riders,
  COUNT(DISTINCT asm_id) as unique_asms
FROM orders
WHERE money_state = 'COLLECTED_BY_RIDER'
  AND payment_type = 'COD'
  AND cod_type = 'COD_HARD'
  AND bundle_id IS NULL
  AND is_test = false;
*/

-- Mark existing unbundled collected orders as legacy
-- This allows them to coexist with the new bundle system
UPDATE orders
SET 
  is_legacy_unbundled = true,
  updated_at = NOW()
WHERE money_state = 'COLLECTED_BY_RIDER'
  AND payment_type = 'COD'
  AND cod_type = 'COD_HARD'
  AND bundle_id IS NULL
  AND is_test = false
  AND is_legacy_unbundled = false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_legacy_unbundled 
ON orders(is_legacy_unbundled, money_state, asm_id)
WHERE is_legacy_unbundled = true;

-- Add comment explaining the migration
COMMENT ON COLUMN orders.is_legacy_unbundled IS 
  'Marks orders collected before bundle system was implemented. These orders can be manually bundled or processed through legacy flow.';

-- Verification query: Check migration results
-- Run this after migration to verify:
/*
SELECT 
  is_legacy_unbundled,
  COUNT(*) as order_count,
  SUM(cod_amount) as total_amount
FROM orders
WHERE money_state = 'COLLECTED_BY_RIDER'
  AND payment_type = 'COD'
  AND cod_type = 'COD_HARD'
  AND is_test = false
GROUP BY is_legacy_unbundled;
*/
