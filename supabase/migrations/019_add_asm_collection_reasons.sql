-- Add ASM collection reason fields to orders table
-- These fields track why ASM didn't collect an order and future collection plans

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS asm_non_collected_reason TEXT,
  ADD COLUMN IF NOT EXISTS asm_future_collection_possible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS asm_expected_collection_date DATE,
  ADD COLUMN IF NOT EXISTS asm_collection_reason_updated_at TIMESTAMPTZ;

-- Add index for querying orders with collection reasons
CREATE INDEX IF NOT EXISTS idx_orders_asm_collection_reason 
  ON public.orders(asm_id, asm_future_collection_possible, asm_expected_collection_date)
  WHERE asm_non_collected_reason IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.asm_non_collected_reason IS 'Reason why ASM did not collect cash from customer';
COMMENT ON COLUMN public.orders.asm_future_collection_possible IS 'Whether ASM expects to collect this order in the future';
COMMENT ON COLUMN public.orders.asm_expected_collection_date IS 'Expected date for future collection if asm_future_collection_possible is true';
COMMENT ON COLUMN public.orders.asm_collection_reason_updated_at IS 'Timestamp when collection reason was last updated';

