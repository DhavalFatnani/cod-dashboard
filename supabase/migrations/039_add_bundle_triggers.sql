-- Migration 039: Add bundle triggers and functions
-- Creates triggers for bundle state management and validation

-- ============================================================================
-- VALIDATION FUNCTIONS
-- ============================================================================

-- Function to validate bundle denominations match expected amount
CREATE OR REPLACE FUNCTION validate_bundle_denominations(p_bundle_id UUID)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
  v_denomination_breakdown JSONB;
  v_expected_amount DECIMAL(12, 2);
  v_calculated_amount DECIMAL(12, 2) := 0;
  v_denomination TEXT;
  v_count INTEGER;
BEGIN
  -- Get bundle details
  SELECT denomination_breakdown, expected_amount
  INTO v_denomination_breakdown, v_expected_amount
  FROM public.rider_bundles
  WHERE id = p_bundle_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bundle % not found', p_bundle_id;
  END IF;
  
  -- Calculate sum from denomination breakdown
  FOR v_denomination, v_count IN SELECT * FROM jsonb_each_text(v_denomination_breakdown)
  LOOP
    v_calculated_amount := v_calculated_amount + (v_denomination::DECIMAL(12, 2) * v_count::INTEGER);
  END LOOP;
  
  RETURN v_calculated_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to check unbundled SLA violations
CREATE OR REPLACE FUNCTION check_unbundled_sla(
  p_rider_id TEXT,
  p_threshold_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
  order_id UUID,
  order_number TEXT,
  collected_at TIMESTAMPTZ,
  unbundled_minutes INTEGER,
  collected_amount DECIMAL(12, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.collected_at,
    EXTRACT(EPOCH FROM (NOW() - o.collected_at)) / 60::INTEGER as unbundled_minutes,
    o.collected_amount
  FROM public.orders o
  WHERE o.rider_id = p_rider_id
    AND o.payment_type = 'COD'
    AND o.cod_type IN ('COD_HARD', 'COD_QR')
    AND o.bundle_id IS NULL
    AND o.money_state = 'COLLECTED_BY_RIDER'
    AND o.collected_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (NOW() - o.collected_at)) / 60 > p_threshold_minutes
  ORDER BY o.collected_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Trigger function: When rider bundle is created
CREATE OR REPLACE FUNCTION on_rider_bundle_created()
RETURNS TRIGGER AS $$
DECLARE
  v_order_record RECORD;
  v_total_amount DECIMAL(12, 2) := 0;
  v_validated_amount DECIMAL(12, 2);
BEGIN
  -- Validate denominations match expected amount
  v_validated_amount := validate_bundle_denominations(NEW.id);
  
  IF ABS(v_validated_amount - NEW.expected_amount) > 0.01 THEN
    RAISE EXCEPTION 'Denomination breakdown (₹%) does not match expected amount (₹%)', 
      v_validated_amount, NEW.expected_amount;
  END IF;
  
  -- Update orders to BUNDLED state and set bundle_id
  FOR v_order_record IN
    SELECT order_id FROM public.rider_bundle_orders WHERE bundle_id = NEW.id
  LOOP
    -- Calculate total from orders
    SELECT COALESCE(SUM(collected_amount), 0) INTO v_total_amount
    FROM public.orders
    WHERE id IN (SELECT order_id FROM public.rider_bundle_orders WHERE bundle_id = NEW.id);
    
    -- Update order state
    UPDATE public.orders
    SET 
      bundle_id = NEW.id,
      money_state = 'BUNDLED',
      updated_at = NOW()
    WHERE id = v_order_record.order_id
      AND money_state = 'COLLECTED_BY_RIDER';
  END LOOP;
  
  -- Create audit log entry
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    changes,
    metadata
  ) VALUES (
    'rider_bundles',
    NEW.id::TEXT,
    'CREATE',
    auth.uid(),
    jsonb_build_object(
      'rider_id', NEW.rider_id,
      'expected_amount', NEW.expected_amount,
      'order_count', (SELECT COUNT(*) FROM public.rider_bundle_orders WHERE bundle_id = NEW.id)
    ),
    jsonb_build_object('bundle_status', NEW.status)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: When bundle is marked READY_FOR_HANDOVER
CREATE OR REPLACE FUNCTION on_rider_bundle_ready()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow status change from CREATED to READY_FOR_HANDOVER
  IF OLD.status != 'CREATED' AND NEW.status = 'READY_FOR_HANDOVER' THEN
    RAISE EXCEPTION 'Bundle can only be marked ready from CREATED status, current status: %', OLD.status;
  END IF;
  
  -- Update orders to READY_FOR_HANDOVER state
  IF NEW.status = 'READY_FOR_HANDOVER' AND OLD.status = 'CREATED' THEN
    UPDATE public.orders
    SET 
      money_state = 'READY_FOR_HANDOVER',
      updated_at = NOW()
    WHERE bundle_id = NEW.id
      AND money_state = 'BUNDLED';
    
    -- Set sealed_at timestamp
    NEW.sealed_at := NOW();
  END IF;
  
  -- Enforce immutability: prevent modifications after READY_FOR_HANDOVER
  IF OLD.status = 'READY_FOR_HANDOVER' AND NEW.status != OLD.status THEN
    -- Allow status changes (to HANDEDOVER_TO_ASM, REJECTED, etc.) but not field changes
    IF NEW.denomination_breakdown != OLD.denomination_breakdown OR
       NEW.expected_amount != OLD.expected_amount OR
       NEW.photo_proofs != OLD.photo_proofs THEN
      RAISE EXCEPTION 'Bundle cannot be modified after being sealed (READY_FOR_HANDOVER)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: When superbundle is created
CREATE OR REPLACE FUNCTION on_superbundle_created()
RETURNS TRIGGER AS $$
DECLARE
  v_bundle_record RECORD;
  v_aggregated_denominations JSONB := '{}'::JSONB;
  v_denomination TEXT;
  v_count INTEGER;
  v_total_amount DECIMAL(12, 2) := 0;
BEGIN
  -- Aggregate denominations from all included bundles
  FOR v_bundle_record IN
    SELECT rb.id, rb.denomination_breakdown, rb.expected_amount
    FROM public.rider_bundles rb
    JOIN public.asm_superbundle_bundles asbb ON rb.id = asbb.bundle_id
    WHERE asbb.superbundle_id = NEW.id
  LOOP
    -- Merge denomination breakdowns
    FOR v_denomination, v_count IN SELECT * FROM jsonb_each_text(v_bundle_record.denomination_breakdown)
    LOOP
      v_aggregated_denominations := jsonb_set(
        v_aggregated_denominations,
        ARRAY[v_denomination],
        to_jsonb((COALESCE((v_aggregated_denominations->>v_denomination)::INTEGER, 0) + v_count)::TEXT)
      );
    END LOOP;
    
    v_total_amount := v_total_amount + v_bundle_record.expected_amount;
  END LOOP;
  
  -- Validate aggregated denominations match expected amount
  DECLARE
    v_calculated_amount DECIMAL(12, 2) := 0;
  BEGIN
    FOR v_denomination, v_count IN SELECT * FROM jsonb_each_text(v_aggregated_denominations)
    LOOP
      v_calculated_amount := v_calculated_amount + (v_denomination::DECIMAL(12, 2) * v_count::INTEGER);
    END LOOP;
    
    IF ABS(v_calculated_amount - NEW.expected_amount) > 0.01 THEN
      RAISE EXCEPTION 'Superbundle denomination breakdown (₹%) does not match expected amount (₹%)', 
        v_calculated_amount, NEW.expected_amount;
    END IF;
  END;
  
  -- Update bundle statuses to INCLUDED_IN_SUPERBUNDLE
  UPDATE public.rider_bundles
  SET 
    status = 'INCLUDED_IN_SUPERBUNDLE',
    updated_at = NOW()
  WHERE id IN (
    SELECT bundle_id FROM public.asm_superbundle_bundles WHERE superbundle_id = NEW.id
  );
  
  -- Update orders state to INCLUDED_IN_SUPERBUNDLE
  UPDATE public.orders
  SET 
    superbundle_id = NEW.id,
    money_state = 'INCLUDED_IN_SUPERBUNDLE',
    updated_at = NOW()
  WHERE bundle_id IN (
    SELECT bundle_id FROM public.asm_superbundle_bundles WHERE superbundle_id = NEW.id
  );
  
  -- Create audit log entry
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    changes,
    metadata
  ) VALUES (
    'asm_superbundles',
    NEW.id::TEXT,
    'CREATE',
    auth.uid(),
    jsonb_build_object(
      'asm_id', NEW.asm_id,
      'expected_amount', NEW.expected_amount,
      'bundle_count', (SELECT COUNT(*) FROM public.asm_superbundle_bundles WHERE superbundle_id = NEW.id)
    ),
    jsonb_build_object('superbundle_status', NEW.status)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE EXISTING ORDER STATE FUNCTION
-- ============================================================================

-- Update the existing update_order_money_state function to handle bundle states
CREATE OR REPLACE FUNCTION update_order_money_state()
RETURNS TRIGGER AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_collected_amount DECIMAL(12, 2);
  v_updated_count INTEGER;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  
  -- If order doesn't exist, log and return
  IF NOT FOUND THEN
    RAISE WARNING 'Order % not found for event %', NEW.order_id, NEW.id;
    RETURN NEW;
  END IF;
  
  -- Use collected_amount from event if provided, otherwise use amount
  v_collected_amount := COALESCE(NEW.collected_amount, NEW.amount, v_order.cod_amount);
  
  -- Update order based on event type
  IF NEW.event_type = 'COLLECTED' THEN
    UPDATE public.orders
    SET money_state = 'COLLECTED_BY_RIDER',
        collected_at = NEW.created_at,
        rider_id = NEW.rider_id,
        rider_name = NEW.rider_name,
        collected_amount = v_collected_amount,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
  ELSIF NEW.event_type = 'HANDOVER_TO_ASM' THEN
    -- Only update if not in a bundle or if bundle is ready
    UPDATE public.orders
    SET money_state = CASE 
        WHEN bundle_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.rider_bundles 
          WHERE id = orders.bundle_id AND status = 'READY_FOR_HANDOVER'
        ) THEN 'HANDOVER_TO_ASM'
        WHEN bundle_id IS NOT NULL THEN 'READY_FOR_HANDOVER'
        ELSE 'HANDOVER_TO_ASM'
      END,
        handover_to_asm_at = NEW.created_at,
        asm_id = NEW.asm_id,
        asm_name = NEW.asm_name,
        collected_amount = COALESCE(v_collected_amount, collected_amount, cod_amount),
        updated_at = NOW()
    WHERE id = NEW.order_id;
    
  ELSIF NEW.event_type = 'DEPOSITED' THEN
    UPDATE public.orders
    SET money_state = 'DEPOSITED',
        deposited_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.order_id;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count = 0 THEN
      RAISE WARNING 'DEPOSITED event for order % did not update any rows', NEW.order_id;
    END IF;
    
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error updating order state for order %: %', NEW.order_id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger on rider_bundles insert
DROP TRIGGER IF EXISTS trigger_rider_bundle_created ON public.rider_bundles;
CREATE TRIGGER trigger_rider_bundle_created
  AFTER INSERT ON public.rider_bundles
  FOR EACH ROW
  EXECUTE FUNCTION on_rider_bundle_created();

-- Trigger on rider_bundles update (for status changes)
DROP TRIGGER IF EXISTS trigger_rider_bundle_ready ON public.rider_bundles;
CREATE TRIGGER trigger_rider_bundle_ready
  BEFORE UPDATE ON public.rider_bundles
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION on_rider_bundle_ready();

-- Trigger on asm_superbundles insert
DROP TRIGGER IF EXISTS trigger_superbundle_created ON public.asm_superbundles;
CREATE TRIGGER trigger_superbundle_created
  AFTER INSERT ON public.asm_superbundles
  FOR EACH ROW
  EXECUTE FUNCTION on_superbundle_created();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_bundle_denominations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_unbundled_sla(TEXT, INTEGER) TO authenticated;

-- Add comments
COMMENT ON FUNCTION validate_bundle_denominations(UUID) IS 'Validates that bundle denomination breakdown sums to expected amount';
COMMENT ON FUNCTION check_unbundled_sla(TEXT, INTEGER) IS 'Returns orders that have been unbundled longer than threshold minutes';
COMMENT ON FUNCTION on_rider_bundle_created() IS 'Trigger function: validates denominations and updates orders to BUNDLED state';
COMMENT ON FUNCTION on_rider_bundle_ready() IS 'Trigger function: enforces immutability and updates orders to READY_FOR_HANDOVER';
COMMENT ON FUNCTION on_superbundle_created() IS 'Trigger function: aggregates bundles and updates statuses to INCLUDED_IN_SUPERBUNDLE';
