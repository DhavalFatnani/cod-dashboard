-- Extend deposit_orders table with collection status and reasons
-- Extend deposits table with validation fields

-- Add fields to deposit_orders table
ALTER TABLE public.deposit_orders
  ADD COLUMN IF NOT EXISTS collection_status TEXT CHECK (collection_status IN ('COLLECTED', 'NOT_COLLECTED')),
  ADD COLUMN IF NOT EXISTS non_collection_reason TEXT,
  ADD COLUMN IF NOT EXISTS future_collection_date DATE,
  ADD COLUMN IF NOT EXISTS asm_handover_data_id UUID REFERENCES public.asm_handover_data(id);

-- Add fields to deposits table
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS expected_amount DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS actual_amount_received DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING', 'VALIDATED', 'MISMATCH')),
  ADD COLUMN IF NOT EXISTS asm_handover_data_id UUID REFERENCES public.asm_handover_data(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deposit_orders_collection_status 
  ON public.deposit_orders(collection_status);
CREATE INDEX IF NOT EXISTS idx_deposit_orders_handover_data_id 
  ON public.deposit_orders(asm_handover_data_id);
CREATE INDEX IF NOT EXISTS idx_deposits_handover_data_id 
  ON public.deposits(asm_handover_data_id);
CREATE INDEX IF NOT EXISTS idx_deposits_validation_status 
  ON public.deposits(validation_status);

-- Add comments
COMMENT ON COLUMN public.deposit_orders.collection_status IS 'Whether order was collected (COLLECTED) or not (NOT_COLLECTED) by ASM';
COMMENT ON COLUMN public.deposit_orders.non_collection_reason IS 'Reason why order was not collected, if collection_status is NOT_COLLECTED';
COMMENT ON COLUMN public.deposit_orders.future_collection_date IS 'Expected date for future collection if applicable';
COMMENT ON COLUMN public.deposits.expected_amount IS 'Expected cash amount from ASM (sum of collected orders)';
COMMENT ON COLUMN public.deposits.actual_amount_received IS 'Actual cash amount received by SM';
COMMENT ON COLUMN public.deposits.validation_status IS 'Validation status: PENDING, VALIDATED (expected = actual), MISMATCH (expected ≠ actual)';

