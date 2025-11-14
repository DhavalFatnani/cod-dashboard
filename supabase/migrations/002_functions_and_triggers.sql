-- Function to update order money state based on events
CREATE OR REPLACE FUNCTION update_order_money_state()
RETURNS TRIGGER AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  
  -- Update order based on event type
  IF NEW.event_type = 'COLLECTED' THEN
    UPDATE public.orders
    SET money_state = 'COLLECTED_BY_RIDER',
        collected_at = NEW.created_at,
        rider_id = NEW.rider_id,
        rider_name = NEW.rider_name,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
  ELSIF NEW.event_type = 'HANDOVER_TO_ASM' THEN
    UPDATE public.orders
    SET money_state = 'HANDOVER_TO_ASM',
        handover_to_asm_at = NEW.created_at,
        asm_id = NEW.asm_id,
        asm_name = NEW.asm_name,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
  ELSIF NEW.event_type = 'DEPOSITED' THEN
    UPDATE public.orders
    SET money_state = 'DEPOSITED',
        deposited_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
  ELSIF NEW.event_type = 'RECONCILED' THEN
    UPDATE public.orders
    SET money_state = 'RECONCILED',
        reconciled_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
  ELSIF NEW.event_type = 'CANCELLED' THEN
    UPDATE public.orders
    SET money_state = 'CANCELLED',
        cancelled_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
  ELSIF NEW.event_type = 'RTO' THEN
    UPDATE public.orders
    SET money_state = 'CANCELLED',
        cod_type = 'RTO',
        rto_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rider events
CREATE TRIGGER update_order_on_rider_event
  AFTER INSERT ON public.rider_events
  FOR EACH ROW
  EXECUTE FUNCTION update_order_money_state();

-- Trigger for ASM events
CREATE TRIGGER update_order_on_asm_event
  AFTER INSERT ON public.asm_events
  FOR EACH ROW
  EXECUTE FUNCTION update_order_money_state();

-- Function to calculate KPI metrics (optimized for performance)
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
        'amount', COALESCE(SUM(order_amount), 0)
      )
      FROM public.orders
      WHERE is_test = false
        AND payment_type = 'PREPAID'
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

-- Function to get order timeline
CREATE OR REPLACE FUNCTION get_order_timeline(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_timeline JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'type', 'rider_event',
      'event_type', event_type,
      'actor', rider_name,
      'actor_id', rider_id,
      'amount', amount,
      'notes', notes,
      'timestamp', created_at,
      'metadata', metadata
    )
    ORDER BY created_at
  ) INTO v_timeline
  FROM public.rider_events
  WHERE order_id = p_order_id;
  
  -- Merge ASM events
  SELECT COALESCE(v_timeline, '[]'::jsonb) || jsonb_agg(
    jsonb_build_object(
      'id', id,
      'type', 'asm_event',
      'event_type', event_type,
      'actor', asm_name,
      'actor_id', asm_id,
      'amount', amount,
      'notes', notes,
      'timestamp', created_at,
      'metadata', metadata
    )
    ORDER BY created_at
  ) INTO v_timeline
  FROM public.asm_events
  WHERE order_id = p_order_id;
  
  RETURN COALESCE(v_timeline, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

