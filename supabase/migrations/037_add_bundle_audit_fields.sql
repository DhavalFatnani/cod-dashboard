-- Migration 037: Add bundle audit fields
-- Adds unbundled_reason, asm_validation_status, asm_comments to orders and asm_handover_data

-- Add audit fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS unbundled_reason TEXT,
  ADD COLUMN IF NOT EXISTS asm_validation_status TEXT CHECK (asm_validation_status IN ('PENDING', 'ACCEPTED', 'REJECTED') OR asm_validation_status IS NULL),
  ADD COLUMN IF NOT EXISTS asm_comments TEXT;

-- Add audit fields to asm_handover_data table
ALTER TABLE public.asm_handover_data
  ADD COLUMN IF NOT EXISTS unbundled_reason TEXT,
  ADD COLUMN IF NOT EXISTS asm_validation_status TEXT CHECK (asm_validation_status IN ('PENDING', 'ACCEPTED', 'REJECTED') OR asm_validation_status IS NULL),
  ADD COLUMN IF NOT EXISTS asm_comments TEXT;

-- Create indexes for audit fields
CREATE INDEX IF NOT EXISTS idx_orders_unbundled_reason ON public.orders(unbundled_reason) WHERE unbundled_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_asm_validation_status ON public.orders(asm_validation_status) WHERE asm_validation_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asm_handover_data_asm_validation_status ON public.asm_handover_data(asm_validation_status) WHERE asm_validation_status IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.orders.unbundled_reason IS 'Reason provided by rider for not bundling an order (when bundle_id is NULL but money_state is COLLECTED_BY_RIDER)';
COMMENT ON COLUMN public.orders.asm_validation_status IS 'ASM validation status for bundle acceptance: PENDING, ACCEPTED, or REJECTED';
COMMENT ON COLUMN public.orders.asm_comments IS 'ASM comments or notes regarding order validation';
COMMENT ON COLUMN public.asm_handover_data.unbundled_reason IS 'Reason for unbundled orders in handover data';
COMMENT ON COLUMN public.asm_handover_data.asm_validation_status IS 'ASM validation status for handover data';
COMMENT ON COLUMN public.asm_handover_data.asm_comments IS 'ASM comments or notes regarding handover data';
