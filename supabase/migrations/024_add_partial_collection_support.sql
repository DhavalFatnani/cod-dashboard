-- Add partial collection support
-- Add collected_amount to orders table to track actual amount collected vs cod_amount
ALTER TABLE public.orders
ADD COLUMN collected_amount DECIMAL(12, 2),
ADD COLUMN collection_discrepancy DECIMAL(12, 2) GENERATED ALWAYS AS (cod_amount - COALESCE(collected_amount, cod_amount)) STORED,
ADD COLUMN is_partial_collection BOOLEAN GENERATED ALWAYS AS (
  CASE 
    WHEN collected_amount IS NOT NULL AND collected_amount < cod_amount THEN TRUE
    ELSE FALSE
  END
) STORED;

-- Add index for partial collections
CREATE INDEX idx_orders_partial_collection ON public.orders(is_partial_collection) WHERE is_partial_collection = TRUE;
CREATE INDEX idx_orders_collection_discrepancy ON public.orders(collection_discrepancy) WHERE collection_discrepancy > 0;

-- Add collected_amount to asm_events (for tracking partial collections)
ALTER TABLE public.asm_events
ADD COLUMN collected_amount DECIMAL(12, 2);

-- Add collected_amount to rider_events (for tracking partial collections)
ALTER TABLE public.rider_events
ADD COLUMN collected_amount DECIMAL(12, 2);

-- Update the trigger function to handle partial collections
CREATE OR REPLACE FUNCTION update_order_money_state()
RETURNS TRIGGER AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_collected_amount DECIMAL(12, 2);
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  
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

