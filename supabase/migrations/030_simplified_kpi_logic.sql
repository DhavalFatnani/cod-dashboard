-- Simplified and corrected KPI logic based on MECE principles
-- This replaces the complex logic with cleaner, more maintainable queries

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
BEGIN
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
          cod_type = 'CANCELLED'  -- Legacy format
          OR (money_state = 'CANCELLED' AND cod_type IS DISTINCT FROM 'RTO')  -- New format, exclude RTO
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
        AND cod_type IS DISTINCT FROM 'RTO'  -- Exclude RTO prepaid orders
        AND (cod_type IS DISTINCT FROM 'CANCELLED' OR cod_type IS NULL)  -- Exclude cancelled prepaid orders
        AND money_state IS DISTINCT FROM 'CANCELLED'  -- Exclude cancelled prepaid orders
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
            AND cod_type = 'COD_HARD'  -- This already excludes CANCELLED and RTO
            AND money_state IS DISTINCT FROM 'CANCELLED'  -- Exclude cancelled orders
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
            AND cod_type = 'COD_QR'  -- This already excludes CANCELLED and RTO
            AND money_state IS DISTINCT FROM 'CANCELLED'  -- Exclude cancelled orders
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
        AND cod_type IN ('COD_HARD', 'COD_QR')  -- Only active COD types (excludes CANCELLED and RTO)
        AND money_state IS DISTINCT FROM 'CANCELLED'  -- Exclude cancelled orders
        AND (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
        AND (p_store_id IS NULL OR store_id = p_store_id)
        AND (p_rider_id IS NULL OR rider_id = p_rider_id)
        AND (p_asm_id IS NULL OR asm_id = p_asm_id)
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

