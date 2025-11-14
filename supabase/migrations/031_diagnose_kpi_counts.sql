-- Diagnostic query to compare actual database counts with KPI function output
-- Run this to see what's happening

-- 1. Actual counts from database
SELECT 
  'Database Counts' as source,
  COUNT(*) FILTER (WHERE is_test = false) as total_orders,
  COUNT(*) FILTER (WHERE is_test = false AND payment_type = 'PREPAID' AND cod_type IS DISTINCT FROM 'RTO' AND (cod_type IS DISTINCT FROM 'CANCELLED' OR cod_type IS NULL) AND money_state IS DISTINCT FROM 'CANCELLED') as prepaid,
  COUNT(*) FILTER (WHERE is_test = false AND (cod_type = 'CANCELLED' OR (money_state = 'CANCELLED' AND cod_type IS DISTINCT FROM 'RTO'))) as cancelled,
  COUNT(*) FILTER (WHERE is_test = false AND cod_type = 'RTO') as rto,
  COUNT(*) FILTER (WHERE is_test = false AND payment_type = 'COD' AND cod_type IN ('COD_HARD', 'COD_QR') AND money_state IS DISTINCT FROM 'CANCELLED') as cod,
  COUNT(*) FILTER (WHERE is_test = false AND payment_type = 'COD' AND cod_type = 'COD_HARD' AND money_state IS DISTINCT FROM 'CANCELLED') as cod_hard,
  COUNT(*) FILTER (WHERE is_test = false AND payment_type = 'COD' AND cod_type = 'COD_QR' AND money_state IS DISTINCT FROM 'CANCELLED') as cod_qr
FROM public.orders;

-- 2. KPI function output
SELECT get_kpi_metrics() as kpi_output;

-- 3. Breakdown by payment_type and cod_type
SELECT 
  payment_type,
  cod_type,
  money_state,
  COUNT(*) as count
FROM public.orders
WHERE is_test = false
GROUP BY payment_type, cod_type, money_state
ORDER BY payment_type, cod_type NULLS LAST, money_state;

-- 4. Check for orders that might be counted incorrectly
SELECT 
  'Cancelled but cod_type not NULL' as issue,
  COUNT(*) as count
FROM public.orders
WHERE is_test = false
  AND money_state = 'CANCELLED'
  AND cod_type IS NOT NULL
  AND cod_type != 'RTO'
  AND cod_type != 'CANCELLED';

SELECT 
  'RTO but money_state not CANCELLED' as issue,
  COUNT(*) as count
FROM public.orders
WHERE is_test = false
  AND cod_type = 'RTO'
  AND money_state != 'CANCELLED';

SELECT 
  'COD with cod_type CANCELLED' as issue,
  COUNT(*) as count
FROM public.orders
WHERE is_test = false
  AND payment_type = 'COD'
  AND cod_type = 'CANCELLED';

SELECT 
  'COD with cod_type RTO' as issue,
  COUNT(*) as count
FROM public.orders
WHERE is_test = false
  AND payment_type = 'COD'
  AND cod_type = 'RTO';

