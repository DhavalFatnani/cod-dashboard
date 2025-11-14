-- Create ASM handover data table
-- This table stores ASM's order-level collection data submitted to SM

CREATE TABLE IF NOT EXISTS public.asm_handover_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asm_id TEXT NOT NULL,
  sm_id TEXT,
  handover_date DATE NOT NULL,
  expected_amount DECIMAL(12, 2) NOT NULL,
  actual_amount_received DECIMAL(12, 2),
  handover_data_file_url TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VALIDATED', 'SUBMITTED')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asm_handover_data_asm_id 
  ON public.asm_handover_data(asm_id);
CREATE INDEX IF NOT EXISTS idx_asm_handover_data_sm_id 
  ON public.asm_handover_data(sm_id);
CREATE INDEX IF NOT EXISTS idx_asm_handover_data_status 
  ON public.asm_handover_data(status);
CREATE INDEX IF NOT EXISTS idx_asm_handover_data_handover_date 
  ON public.asm_handover_data(handover_date DESC);

-- Add comments for documentation
COMMENT ON TABLE public.asm_handover_data IS 'Stores ASM handover data submitted to SM for cash collection';
COMMENT ON COLUMN public.asm_handover_data.expected_amount IS 'Sum of COD amounts for orders marked as collected by ASM';
COMMENT ON COLUMN public.asm_handover_data.actual_amount_received IS 'Actual cash amount received by SM';
COMMENT ON COLUMN public.asm_handover_data.handover_data_file_url IS 'URL to CSV/XLSX file uploaded by ASM with order-level data';
COMMENT ON COLUMN public.asm_handover_data.status IS 'Status: PENDING (created by ASM), VALIDATED (validated by SM), SUBMITTED (deposit created)';

