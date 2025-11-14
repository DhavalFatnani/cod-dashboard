-- Enhanced KPI metrics function with more detailed metrics
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
  -- Calculate base totals for performance metrics
  SELECT 
    COALESCE(SUM(CASE WHEN payment_type = 'COD' THEN cod_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'COD' AND money_state IN ('COLLECTED_BY_RIDER', 'HANDOVER_TO_ASM', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED') THEN cod_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'COD' AND money_state IN ('DEPOSITED', 'RECONCILED') THEN cod_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'COD' AND money_state = 'RECONCILED' THEN cod_amount ELSE 0 END), 0)
  INTO v_total_cod, v_collected_cod, v_deposited_cod, v_reconciled_cod
  FROM public.orders
  WHERE is_test = false
    AND (p_start_date IS NULL OR created_at >= p_start_date)
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
          WHERE is_test = false
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
          WHERE is_test = false
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
          WHERE is_test = false
            AND created_at >= date_trunc('month', CURRENT_DATE)
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
          WHEN v_total_cod > 0 THEN ROUND((v_collected_cod / v_total_cod * 100)::numeric, 2)
          ELSE 0
        END,
        'deposit_rate', CASE 
          WHEN v_total_cod > 0 THEN ROUND((v_deposited_cod / v_total_cod * 100)::numeric, 2)
          ELSE 0
        END,
        'reconciliation_rate', CASE 
          WHEN v_total_cod > 0 THEN ROUND((v_reconciled_cod / v_total_cod * 100)::numeric, 2)
          ELSE 0
        END,
        'hard', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE is_test = false
            AND payment_type = 'COD'
            AND cod_type = 'COD_HARD'
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
          WHERE is_test = false
            AND payment_type = 'COD'
            AND cod_type = 'COD_QR'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'cancelled', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE is_test = false
            AND payment_type = 'COD'
            AND cod_type = 'CANCELLED'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        ),
        'rto', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE is_test = false
            AND payment_type = 'COD'
            AND cod_type = 'RTO'
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
          WHERE is_test = false
            AND payment_type = 'COD'
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
          WHERE is_test = false
            AND payment_type = 'COD'
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
          WHERE is_test = false
            AND payment_type = 'COD'
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
          WHERE is_test = false
            AND payment_type = 'COD'
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
          WHERE is_test = false
            AND payment_type = 'COD'
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
          WHERE is_test = false
            AND payment_type = 'COD'
            AND money_state = 'RECONCILIATION_EXCEPTION'
            AND (p_start_date IS NULL OR created_at >= p_start_date)
            AND (p_end_date IS NULL OR created_at <= p_end_date)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        )
      )
      FROM public.orders
      WHERE is_test = false
        AND payment_type = 'COD'
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
          WHERE is_test = false
            AND payment_type = 'PREPAID'
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
          WHERE is_test = false
            AND payment_type = 'PREPAID'
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
          WHERE is_test = false
            AND payment_type = 'PREPAID'
            AND created_at >= date_trunc('month', CURRENT_DATE)
            AND (p_store_id IS NULL OR store_id = p_store_id)
            AND (p_rider_id IS NULL OR rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR asm_id = p_asm_id)
        )
      )
      FROM public.orders
      WHERE is_test = false
        AND payment_type = 'PREPAID'
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
      WHERE is_test = false
        AND payment_type = 'COD'
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
      WHERE is_test = false
        AND payment_type = 'COD'
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
      WHERE is_test = false
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    )
  ) INTO v_result
  FROM public.orders
  WHERE is_test = false
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND (p_store_id IS NULL OR store_id = p_store_id)
    AND (p_rider_id IS NULL OR rider_id = p_rider_id)
    AND (p_asm_id IS NULL OR asm_id = p_asm_id)
  LIMIT 1;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

