-- Diagnostic query to check cod_type distribution
-- Run this first to see what's happening:
-- SELECT 
--   cod_type,
--   COUNT(*) as count,
--   SUM(cod_amount) as total_amount
-- FROM public.orders
-- WHERE payment_type = 'COD'
-- GROUP BY cod_type;

-- Fix: Ensure the main COD count only includes COD_HARD and COD_QR
-- Also handle NULL cod_type values (they should be excluded or categorized)

CREATE OR REPLACE FUNCTION get_kpi_metrics(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_store_id TEXT DEFAULT NULL,
  p_rider_id TEXT DEFAULT NULL,
  p_asm_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_cod DECIMAL;
  v_collected_cod DECIMAL;
  v_deposited_cod DECIMAL;
  v_reconciled_cod DECIMAL;
BEGIN
  -- Calculate base totals for performance metrics (including test orders)
  -- MECE Principle: Only count active COD orders (COD_HARD and COD_QR), excluding CANCELLED, RTO, and NULL
  SELECT 
    COALESCE(SUM(CASE WHEN payment_type = 'COD' AND cod_type IN ('COD_HARD', 'COD_QR') THEN cod_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'COD' AND cod_type IN ('COD_HARD', 'COD_QR') AND money_state IN ('COLLECTED_BY_RIDER', 'HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED') THEN cod_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'COD' AND cod_type IN ('COD_HARD', 'COD_QR') AND money_state IN ('DEPOSITED', 'RECONCILED') THEN cod_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'COD' AND cod_type IN ('COD_HARD', 'COD_QR') AND money_state = 'RECONCILED' THEN cod_amount ELSE 0 END), 0)
  INTO v_total_cod, v_collected_cod, v_deposited_cod, v_reconciled_cod
  FROM public.orders
  WHERE (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND (p_store_id IS NULL OR store_id = p_store_id)
    AND (p_rider_id IS NULL OR rider_id = p_rider_id)
    AND (p_asm_id IS NULL OR asm_id = p_asm_id);

  SELECT jsonb_build_object(
    'all_orders', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(order_amount), 0),
        'today', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(order_amount), 0)
          )
          FROM public.orders
          WHERE created_at::date = CURRENT_DATE
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'this_week', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(order_amount), 0)
          )
          FROM public.orders
          WHERE created_at >= date_trunc('week', CURRENT_DATE)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'this_month', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(order_amount), 0)
          )
          FROM public.orders
          WHERE created_at >= date_trunc('month', CURRENT_DATE)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        )
      )
      FROM public.orders
      WHERE is_test = false
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'cod', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(cod_amount), 0),
        'total_collected', jsonb_build_object(
          'count', COUNT(*) FILTER (WHERE money_state IN ('COLLECTED_BY_RIDER', 'HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED')),
          'amount', COALESCE(SUM(cod_amount) FILTER (WHERE money_state IN ('COLLECTED_BY_RIDER', 'HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED')), 0)
        ),
        'collection_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE money_state IN ('COLLECTED_BY_RIDER', 'HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED'))::numeric / COUNT(*)::numeric * 100)::numeric, 2)
          ELSE 0
        END,
        'deposit_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE money_state IN ('DEPOSITED', 'RECONCILED'))::numeric / COUNT(*)::numeric * 100)::numeric, 2)
          ELSE 0
        END,
        'reconciliation_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE money_state = 'RECONCILED')::numeric / COUNT(*)::numeric * 100)::numeric, 2)
          ELSE 0
        END,
        'hard', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type = 'COD_HARD'
            AND money_state != 'CANCELLED'
            AND cod_type != 'CANCELLED'
            AND is_test = false
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'qr', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type = 'COD_QR'
            AND money_state != 'CANCELLED'
            AND cod_type != 'CANCELLED'
            AND is_test = false
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        -- Note: cancelled and rto are now tracked at the root level, not under cod
        -- They include both COD and PREPAID orders
        'null_cod_type', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type IS NULL
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'pending_to_collect', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type IN ('COD_HARD', 'COD_QR')
            AND money_state = 'UNCOLLECTED'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'collected_by_rider', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type IN ('COD_HARD', 'COD_QR')
            AND money_state = 'COLLECTED_BY_RIDER'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'pending_to_deposit', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type IN ('COD_HARD', 'COD_QR')
            AND money_state IN ('HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT')
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'deposited', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type IN ('COD_HARD', 'COD_QR')
            AND money_state = 'DEPOSITED'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'reconciled', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type IN ('COD_HARD', 'COD_QR')
            AND money_state = 'RECONCILED'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'exceptions', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'COD'
            AND cod_type IN ('COD_HARD', 'COD_QR')
            AND money_state = 'RECONCILIATION_EXCEPTION'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        )
      )
      FROM public.orders
      WHERE payment_type = 'COD'
        AND cod_type IN ('COD_HARD', 'COD_QR')  -- MECE: Only count active COD orders (exclude NULL, CANCELLED, RTO)
        AND money_state != 'CANCELLED'  -- Explicitly exclude cancelled orders
        AND cod_type != 'CANCELLED'  -- Explicitly exclude legacy cancelled orders
        AND is_test = false
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'cancelled', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(CASE WHEN payment_type = 'COD' THEN cod_amount ELSE order_amount END), 0),
        'cod_count', COUNT(*) FILTER (WHERE payment_type = 'COD'),
        'cod_amount', COALESCE(SUM(cod_amount) FILTER (WHERE payment_type = 'COD'), 0),
        'prepaid_count', COUNT(*) FILTER (WHERE payment_type = 'PREPAID'),
        'prepaid_amount', COALESCE(SUM(order_amount) FILTER (WHERE payment_type = 'PREPAID'), 0)
      )
      FROM public.orders
      WHERE (
        -- Legacy format: cod_type = 'CANCELLED' (these are explicitly cancelled, not RTO)
        cod_type = 'CANCELLED'
        OR
        -- New format: money_state = 'CANCELLED' but NOT RTO and NOT legacy CANCELLED
        (money_state = 'CANCELLED' 
         AND cod_type IS DISTINCT FROM 'RTO'  -- Exclude RTO (handles NULL properly)
         AND cod_type IS DISTINCT FROM 'CANCELLED'  -- Exclude legacy CANCELLED (to avoid double counting)
         AND (cod_type IS NULL OR cod_type IN ('COD_HARD', 'COD_QR')))  -- Only active COD types or NULL (for PREPAID)
      )
        AND is_test = false
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'rto', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(CASE WHEN payment_type = 'COD' THEN cod_amount ELSE order_amount END), 0),
        'cod_count', COUNT(*) FILTER (WHERE payment_type = 'COD'),
        'cod_amount', COALESCE(SUM(cod_amount) FILTER (WHERE payment_type = 'COD'), 0),
        'prepaid_count', COUNT(*) FILTER (WHERE payment_type = 'PREPAID'),
        'prepaid_amount', COALESCE(SUM(order_amount) FILTER (WHERE payment_type = 'PREPAID'), 0)
      )
      FROM public.orders
      WHERE cod_type = 'RTO'
        AND is_test = false
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'prepaid', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(order_amount), 0),
        'today', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(order_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'PREPAID'
            AND created_at::date = CURRENT_DATE
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'this_week', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(order_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'PREPAID'
            AND created_at >= date_trunc('week', CURRENT_DATE)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'this_month', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(order_amount), 0)
          )
          FROM public.orders
          WHERE payment_type = 'PREPAID'
            AND created_at >= date_trunc('month', CURRENT_DATE)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        )
      )
      FROM public.orders
      WHERE payment_type = 'PREPAID'
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'riders', (
      SELECT jsonb_build_object(
        'total_riders', COUNT(DISTINCT rider_id) FILTER (WHERE rider_id IS NOT NULL),
        'total_collected', jsonb_build_object(
          'count', COUNT(*) FILTER (WHERE money_state = 'COLLECTED_BY_RIDER'),
          'amount', COALESCE(SUM(cod_amount) FILTER (WHERE money_state = 'COLLECTED_BY_RIDER'), 0)
        ),
        'avg_per_rider', CASE 
          WHEN COUNT(DISTINCT rider_id) FILTER (WHERE rider_id IS NOT NULL) > 0 
          THEN ROUND((COALESCE(SUM(cod_amount) FILTER (WHERE money_state = 'COLLECTED_BY_RIDER'), 0) / COUNT(DISTINCT rider_id) FILTER (WHERE rider_id IS NOT NULL))::numeric, 2)
          ELSE 0
        END
      )
      FROM public.orders
      WHERE payment_type = 'COD'
        AND cod_type IN ('COD_HARD', 'COD_QR')
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'asms', (
      SELECT jsonb_build_object(
        'total_asms', COUNT(DISTINCT asm_id) FILTER (WHERE asm_id IS NOT NULL),
        'total_deposited', jsonb_build_object(
          'count', COUNT(*) FILTER (WHERE money_state IN ('DEPOSITED', 'RECONCILED')),
          'amount', COALESCE(SUM(cod_amount) FILTER (WHERE money_state IN ('DEPOSITED', 'RECONCILED')), 0)
        ),
        'avg_per_asm', CASE 
          WHEN COUNT(DISTINCT asm_id) FILTER (WHERE asm_id IS NOT NULL) > 0 
          THEN ROUND((COALESCE(SUM(cod_amount) FILTER (WHERE money_state IN ('DEPOSITED', 'RECONCILED')), 0) / COUNT(DISTINCT asm_id) FILTER (WHERE asm_id IS NOT NULL))::numeric, 2)
          ELSE 0
        END
      )
      FROM public.orders
      WHERE payment_type = 'COD'
        AND cod_type IN ('COD_HARD', 'COD_QR')
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'stores', (
      SELECT jsonb_build_object(
        'total_stores', COUNT(DISTINCT store_id),
        'total_orders', COUNT(*),
        'total_amount', COALESCE(SUM(order_amount), 0)
      )
      FROM public.orders
      WHERE (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    )
  ) INTO v_result
  FROM public.orders
  WHERE (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND (p_store_id IS NULL OR store_id = p_store_id)
    AND (p_rider_id IS NULL OR rider_id = p_rider_id)
    AND (p_asm_id IS NULL OR asm_id = p_asm_id)
  LIMIT 1;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

