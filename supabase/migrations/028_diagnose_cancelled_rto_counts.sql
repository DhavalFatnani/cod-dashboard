-- Diagnostic query to understand the cancelled and RTO order counts
-- Run this in Supabase SQL Editor to see what's happening

-- Check orders with cod_type = 'CANCELLED'
SELECT 
  'cod_type = CANCELLED' as category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE cod_type = 'RTO') as rto_count,
  COUNT(*) FILTER (WHERE money_state = 'CANCELLED') as money_state_cancelled
FROM public.orders
WHERE cod_type = 'CANCELLED'
  AND is_test = false;

-- Check orders with money_state = 'CANCELLED' (excluding RTO)
SELECT 
  'money_state = CANCELLED (not RTO)' as category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE cod_type = 'RTO') as rto_count,
  COUNT(*) FILTER (WHERE cod_type = 'CANCELLED') as cod_type_cancelled
FROM public.orders
WHERE money_state = 'CANCELLED'
  AND cod_type IS DISTINCT FROM 'RTO'
  AND (cod_type IS NULL OR cod_type IN ('COD_HARD', 'COD_QR'))
  AND is_test = false;

-- Check orders with cod_type = 'RTO'
SELECT 
  'cod_type = RTO' as category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE money_state = 'CANCELLED') as money_state_cancelled
FROM public.orders
WHERE cod_type = 'RTO'
  AND is_test = false;

-- Check for overlap (orders that might be counted in both cancelled and RTO)
SELECT 
  'Overlap: CANCELLED and RTO' as category,
  COUNT(*) as count
FROM public.orders
WHERE (
  (cod_type = 'CANCELLED' OR (money_state = 'CANCELLED' AND cod_type IS DISTINCT FROM 'RTO'))
  AND cod_type = 'RTO'
)
  AND is_test = false;

-- Check all orders breakdown
SELECT 
  payment_type,
  cod_type,
  money_state,
  COUNT(*) as count
FROM public.orders
WHERE is_test = false
GROUP BY payment_type, cod_type, money_state
ORDER BY payment_type, cod_type, money_state;

