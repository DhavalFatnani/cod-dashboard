-- Migration 034: Add ASM SuperBundles
-- Creates asm_superbundles table, superbundle_status enum, and mapping tables

-- Create superbundle_status enum
CREATE TYPE superbundle_status AS ENUM (
  'CREATED',
  'READY_FOR_HANDOVER',
  'HANDEDOVER_TO_SM',
  'INCLUDED_IN_DEPOSIT',
  'REJECTED'
);

-- Create asm_superbundles table
CREATE TABLE IF NOT EXISTS public.asm_superbundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asm_id TEXT NOT NULL,
  asm_name TEXT,
  sm_id TEXT, -- Assigned SM for handover
  sm_name TEXT,
  expected_amount DECIMAL(12, 2) NOT NULL,
  denomination_breakdown JSONB NOT NULL DEFAULT '{}',
  validated_amount DECIMAL(12, 2), -- Validated by SM
  status superbundle_status NOT NULL DEFAULT 'CREATED',
  digital_signoff BOOLEAN DEFAULT false,
  sealed_at TIMESTAMPTZ, -- When superbundle was marked READY_FOR_HANDOVER
  handedover_at TIMESTAMPTZ, -- When superbundle was handed over to SM
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  deposit_id UUID REFERENCES public.deposits(id) ON DELETE SET NULL, -- Link to deposit when included
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_superbundle_denomination_breakdown CHECK (
    jsonb_typeof(denomination_breakdown) = 'object' AND
    denomination_breakdown != '{}'::jsonb
  ),
  CONSTRAINT valid_superbundle_amount CHECK (expected_amount > 0),
  CONSTRAINT valid_superbundle_validated_amount CHECK (validated_amount IS NULL OR validated_amount > 0)
);

-- Create asm_superbundle_bundles mapping table
CREATE TABLE IF NOT EXISTS public.asm_superbundle_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superbundle_id UUID NOT NULL REFERENCES public.asm_superbundles(id) ON DELETE CASCADE,
  bundle_id UUID NOT NULL REFERENCES public.rider_bundles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one bundle can only be in one superbundle at a time
  UNIQUE(bundle_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asm_superbundles_asm_id ON public.asm_superbundles(asm_id);
CREATE INDEX IF NOT EXISTS idx_asm_superbundles_sm_id ON public.asm_superbundles(sm_id);
CREATE INDEX IF NOT EXISTS idx_asm_superbundles_status ON public.asm_superbundles(status);
CREATE INDEX IF NOT EXISTS idx_asm_superbundles_deposit_id ON public.asm_superbundles(deposit_id);
CREATE INDEX IF NOT EXISTS idx_asm_superbundles_created_at ON public.asm_superbundles(created_at);
CREATE INDEX IF NOT EXISTS idx_asm_superbundle_bundles_superbundle_id ON public.asm_superbundle_bundles(superbundle_id);
CREATE INDEX IF NOT EXISTS idx_asm_superbundle_bundles_bundle_id ON public.asm_superbundle_bundles(bundle_id);

-- Add comments for documentation
COMMENT ON TABLE public.asm_superbundles IS 'ASM superbundles containing multiple rider bundles aggregated for SM deposit';
COMMENT ON COLUMN public.asm_superbundles.denomination_breakdown IS 'JSONB object with aggregated denomination counts from all included bundles';
COMMENT ON COLUMN public.asm_superbundles.status IS 'Superbundle lifecycle status: CREATED -> READY_FOR_HANDOVER -> HANDEDOVER_TO_SM -> INCLUDED_IN_DEPOSIT or REJECTED';
COMMENT ON TABLE public.asm_superbundle_bundles IS 'Many-to-many mapping between ASM superbundles and rider bundles';
