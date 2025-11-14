-- Migration to fix existing cancelled and RTO orders
-- This migrates orders that have cod_type = 'CANCELLED' or cod_type = 'RTO'
-- to use money_state = 'CANCELLED' instead and exclude them from COD totals

-- Step 1: Migrate cancelled orders (cod_type = 'CANCELLED')
-- Convert COD - CANCELLED to CANCELLED and exclude from COD totals
-- Set cod_type to NULL so they're excluded from COD totals (which filter by cod_type IN ('COD_HARD', 'COD_QR'))
-- The payment_type = 'COD' field is preserved so we can still track COD vs PREPAID in cancelled metrics
UPDATE public.orders
SET 
  money_state = 'CANCELLED',
  cod_type = NULL,  -- Set to NULL to exclude from COD totals (COD totals filter by cod_type IN ('COD_HARD', 'COD_QR'))
  cancelled_at = COALESCE(cancelled_at, updated_at, created_at),
  updated_at = NOW()
WHERE cod_type = 'CANCELLED';

-- Step 2: Ensure RTO orders have money_state = 'CANCELLED'
UPDATE public.orders
SET 
  money_state = 'CANCELLED',
  rto_at = COALESCE(rto_at, updated_at, created_at),
  updated_at = NOW()
WHERE cod_type = 'RTO'
  AND money_state != 'CANCELLED';

-- Verify the migration
DO $$
DECLARE
  v_cancelled_count INTEGER;
  v_rto_count INTEGER;
BEGIN
  -- Count orders that should be cancelled (money_state = 'CANCELLED' and not RTO)
  SELECT COUNT(*) INTO v_cancelled_count
  FROM public.orders
  WHERE money_state = 'CANCELLED'
    AND (cod_type IS NULL OR cod_type IN ('COD_HARD', 'COD_QR'));
  
  -- Count RTO orders
  SELECT COUNT(*) INTO v_rto_count
  FROM public.orders
  WHERE cod_type = 'RTO';
  
  RAISE NOTICE 'Migration complete: % cancelled orders, % RTO orders', v_cancelled_count, v_rto_count;
END $$;

