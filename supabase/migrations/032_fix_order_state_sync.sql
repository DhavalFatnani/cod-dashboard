-- Fix order state synchronization between events and orders table
-- This migration ensures that order states are properly updated when events are created

-- First, let's ensure the trigger function is robust and handles all cases
CREATE OR REPLACE FUNCTION update_order_money_state()
RETURNS TRIGGER AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_collected_amount DECIMAL(12, 2);
  v_updated_count INTEGER;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  
  -- If order doesn't exist, log and return (shouldn't happen due to FK constraint)
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
    UPDATE public.orders
    SET money_state = 'HANDOVER_TO_ASM',
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
    
    -- Log if update didn't affect any rows (shouldn't happen, but good for debugging)
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
    -- Log the error but don't fail the event insertion
    RAISE WARNING 'Error updating order state for order %: %', NEW.order_id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist and are properly configured
DROP TRIGGER IF EXISTS update_order_on_rider_event ON public.rider_events;
CREATE TRIGGER update_order_on_rider_event
  AFTER INSERT ON public.rider_events
  FOR EACH ROW
  EXECUTE FUNCTION update_order_money_state();

DROP TRIGGER IF EXISTS update_order_on_asm_event ON public.asm_events;
CREATE TRIGGER update_order_on_asm_event
  AFTER INSERT ON public.asm_events
  FOR EACH ROW
  EXECUTE FUNCTION update_order_money_state();

-- Create a function to manually sync order states from events (for fixing any inconsistencies)
CREATE OR REPLACE FUNCTION sync_order_states_from_events()
RETURNS TABLE(
  order_id UUID,
  order_number TEXT,
  current_state TEXT,
  latest_event_type TEXT,
  latest_event_created_at TIMESTAMPTZ,
  synced BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_events AS (
    SELECT DISTINCT ON (order_id)
      order_id,
      event_type,
      created_at
    FROM (
      SELECT order_id, event_type, created_at
      FROM public.rider_events
      UNION ALL
      SELECT order_id, event_type, created_at
      FROM public.asm_events
    ) all_events
    ORDER BY order_id, created_at DESC
  ),
  state_mapping AS (
    SELECT
      o.id as order_id,
      o.order_number,
      o.money_state as current_state,
      le.event_type as latest_event_type,
      le.created_at as latest_event_created_at,
      CASE le.event_type
        WHEN 'COLLECTED' THEN 'COLLECTED_BY_RIDER'
        WHEN 'HANDOVER_TO_ASM' THEN 'HANDOVER_TO_ASM'
        WHEN 'DEPOSITED' THEN 'DEPOSITED'
        WHEN 'RECONCILED' THEN 'RECONCILED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'RTO' THEN 'CANCELLED'
        ELSE o.money_state
      END as expected_state
    FROM public.orders o
    LEFT JOIN latest_events le ON o.id = le.order_id
    WHERE le.event_type IS NOT NULL
  )
  SELECT
    sm.order_id,
    sm.order_number,
    sm.current_state,
    sm.latest_event_type,
    sm.latest_event_created_at,
    (sm.current_state = sm.expected_state) as synced
  FROM state_mapping sm
  WHERE sm.current_state != sm.expected_state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to fix order states based on latest events
CREATE OR REPLACE FUNCTION fix_order_states_from_events()
RETURNS INTEGER AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_order_record RECORD;
BEGIN
  -- Fix orders based on their latest events
  FOR v_order_record IN
    WITH latest_events AS (
      SELECT DISTINCT ON (order_id)
        order_id,
        event_type,
        created_at,
        CASE 
          WHEN table_name = 'rider_events' THEN 'rider'
          WHEN table_name = 'asm_events' THEN 'asm'
        END as event_source
      FROM (
        SELECT order_id, event_type, created_at, 'rider_events'::text as table_name
        FROM public.rider_events
        UNION ALL
        SELECT order_id, event_type, created_at, 'asm_events'::text as table_name
        FROM public.asm_events
      ) all_events
      ORDER BY order_id, created_at DESC
    )
    SELECT
      o.id,
      o.money_state as current_state,
      le.event_type,
      CASE le.event_type
        WHEN 'COLLECTED' THEN 'COLLECTED_BY_RIDER'
        WHEN 'HANDOVER_TO_ASM' THEN 'HANDOVER_TO_ASM'
        WHEN 'DEPOSITED' THEN 'DEPOSITED'
        WHEN 'RECONCILED' THEN 'RECONCILED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'RTO' THEN 'CANCELLED'
        ELSE o.money_state
      END as expected_state
    FROM public.orders o
    INNER JOIN latest_events le ON o.id = le.order_id
    WHERE o.money_state != CASE le.event_type
      WHEN 'COLLECTED' THEN 'COLLECTED_BY_RIDER'
      WHEN 'HANDOVER_TO_ASM' THEN 'HANDOVER_TO_ASM'
      WHEN 'DEPOSITED' THEN 'DEPOSITED'
      WHEN 'RECONCILED' THEN 'RECONCILED'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      WHEN 'RTO' THEN 'CANCELLED'
      ELSE o.money_state
    END
  LOOP
    -- Update order state
    UPDATE public.orders
    SET money_state = v_order_record.expected_state::money_state,
        updated_at = NOW()
    WHERE id = v_order_record.id;
    
    v_fixed_count := v_fixed_count + 1;
  END LOOP;
  
  RETURN v_fixed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sync_order_states_from_events() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_order_states_from_events() TO authenticated;

COMMENT ON FUNCTION sync_order_states_from_events() IS 'Diagnostic function to check for order state inconsistencies';
COMMENT ON FUNCTION fix_order_states_from_events() IS 'Function to fix order states based on latest events';

