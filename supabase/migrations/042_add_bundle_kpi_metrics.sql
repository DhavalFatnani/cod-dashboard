-- Migration 042: Add bundle metrics to KPI function
-- Extends get_kpi_metrics() to include bundle-related KPIs

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
  v_date_filter_start TIMESTAMPTZ;
  v_date_filter_end TIMESTAMPTZ;
BEGIN
  -- Set date filters
  v_date_filter_start := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  v_date_filter_end := COALESCE(p_end_date, NOW());

  SELECT jsonb_build_object(
    'all_orders', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(order_amount), 0)
      )
      FROM public.orders
      WHERE is_test = false
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
      WHERE is_test = false
        AND (
          cod_type = 'CANCELLED'
          OR (money_state = 'CANCELLED' AND cod_type IS DISTINCT FROM 'RTO')
        )
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
      WHERE is_test = false
        AND cod_type = 'RTO'
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    'prepaid', (
      SELECT jsonb_build_object(
        'count', COUNT(*),
        'amount', COALESCE(SUM(order_amount), 0)
      )
      FROM public.orders
      WHERE is_test = false
        AND payment_type = 'PREPAID'
        AND cod_type IS DISTINCT FROM 'RTO'
        AND (cod_type IS DISTINCT FROM 'CANCELLED' OR cod_type IS NULL)
        AND money_state IS DISTINCT FROM 'CANCELLED'
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
        'hard', (
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(cod_amount), 0)
          )
          FROM public.orders
          WHERE is_test = false
            AND payment_type = 'COD'
            AND cod_type = 'COD_HARD'
            AND money_state IS DISTINCT FROM 'CANCELLED'
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
            AND money_state IS DISTINCT FROM 'CANCELLED'
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
        AND cod_type IN ('COD_HARD', 'COD_QR')
        AND money_state IS DISTINCT FROM 'CANCELLED'
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    ),
    -- Bundle-related KPIs
    'bundles', (
      SELECT jsonb_build_object(
        'rider_unbundled_amount', (
          -- Total unbundled amount per ASM (orders in COLLECTED_BY_RIDER without bundle_id)
          SELECT COALESCE(SUM(o.collected_amount), 0)
          FROM public.orders o
          WHERE o.is_test = false
            AND o.payment_type = 'COD'
            AND o.cod_type IN ('COD_HARD', 'COD_QR')
            AND o.bundle_id IS NULL
            AND o.money_state = 'COLLECTED_BY_RIDER'
            AND (p_start_date IS NULL OR o.collected_at >= p_start_date)
            AND (p_end_date IS NULL OR o.collected_at <= p_end_date)
            AND (p_rider_id IS NULL OR o.rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR o.asm_id = p_asm_id)
        ),
        'rider_bundled_amount', (
          -- Total bundled amount per rider
          SELECT COALESCE(SUM(o.collected_amount), 0)
          FROM public.orders o
          WHERE o.is_test = false
            AND o.payment_type = 'COD'
            AND o.cod_type IN ('COD_HARD', 'COD_QR')
            AND o.bundle_id IS NOT NULL
            AND o.money_state IN ('BUNDLED', 'READY_FOR_HANDOVER', 'HANDOVER_TO_ASM', 'INCLUDED_IN_SUPERBUNDLE')
            AND (p_start_date IS NULL OR o.collected_at >= p_start_date)
            AND (p_end_date IS NULL OR o.collected_at <= p_end_date)
            AND (p_rider_id IS NULL OR o.rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR o.asm_id = p_asm_id)
        ),
        'bundles_pending_handover', (
          -- Count of bundles in READY_FOR_HANDOVER status per ASM
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(rb.expected_amount), 0)
          )
          FROM public.rider_bundles rb
          WHERE rb.status = 'READY_FOR_HANDOVER'
            AND (p_start_date IS NULL OR rb.created_at >= p_start_date)
            AND (p_end_date IS NULL OR rb.created_at <= p_end_date)
            AND (p_asm_id IS NULL OR rb.asm_id = p_asm_id)
            AND (p_rider_id IS NULL OR rb.rider_id = p_rider_id)
        ),
        'superbundles_pending_sm_handover', (
          -- Count of superbundles in READY_FOR_HANDOVER status
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(sb.expected_amount), 0)
          )
          FROM public.asm_superbundles sb
          WHERE sb.status = 'READY_FOR_HANDOVER'
            AND (p_start_date IS NULL OR sb.created_at >= p_start_date)
            AND (p_end_date IS NULL OR sb.created_at <= p_end_date)
            AND (p_asm_id IS NULL OR sb.asm_id = p_asm_id)
        ),
        'sla_violations', (
          -- Orders unbundled for more than 60 minutes
          SELECT jsonb_build_object(
            'count', COUNT(*),
            'amount', COALESCE(SUM(o.collected_amount), 0)
          )
          FROM public.orders o
          WHERE o.is_test = false
            AND o.payment_type = 'COD'
            AND o.cod_type IN ('COD_HARD', 'COD_QR')
            AND o.bundle_id IS NULL
            AND o.money_state = 'COLLECTED_BY_RIDER'
            AND o.collected_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (NOW() - o.collected_at)) / 60 > 60
            AND (p_rider_id IS NULL OR o.rider_id = p_rider_id)
            AND (p_asm_id IS NULL OR o.asm_id = p_asm_id)
        )
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_kpi_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION get_kpi_metrics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) IS 'Returns KPI metrics including bundle-related metrics: rider unbundled/bundled amounts, bundles pending handover, superbundles pending SM handover, and SLA violations';
