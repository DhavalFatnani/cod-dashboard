-- Migration 033: Add Rider Bundles
-- Creates rider_bundles table, bundle_status enum, and rider_bundle_orders mapping table

-- Create bundle_status enum
CREATE TYPE bundle_status AS ENUM (
  'CREATED',
  'READY_FOR_HANDOVER',
  'HANDEDOVER_TO_ASM',
  'INCLUDED_IN_SUPERBUNDLE',
  'REJECTED'
);

-- Create rider_bundles table
CREATE TABLE IF NOT EXISTS public.rider_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id TEXT NOT NULL,
  rider_name TEXT,
  asm_id TEXT, -- Assigned ASM for handover
  asm_name TEXT,
  expected_amount DECIMAL(12, 2) NOT NULL,
  denomination_breakdown JSONB NOT NULL DEFAULT '{}',
  validated_amount DECIMAL(12, 2), -- Validated by ASM
  status bundle_status NOT NULL DEFAULT 'CREATED',
  photo_proofs TEXT[], -- Array of Supabase Storage URLs
  digital_signoff BOOLEAN DEFAULT false,
  sealed_at TIMESTAMPTZ, -- When bundle was marked READY_FOR_HANDOVER
  handedover_at TIMESTAMPTZ, -- When bundle was handed over to ASM
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_denomination_breakdown CHECK (
    jsonb_typeof(denomination_breakdown) = 'object' AND
    denomination_breakdown != '{}'::jsonb
  ),
  CONSTRAINT valid_amount CHECK (expected_amount > 0),
  CONSTRAINT valid_validated_amount CHECK (validated_amount IS NULL OR validated_amount > 0)
);

-- Create rider_bundle_orders mapping table
CREATE TABLE IF NOT EXISTS public.rider_bundle_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES public.rider_bundles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one order can only be in one bundle at a time
  UNIQUE(order_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rider_bundles_rider_id ON public.rider_bundles(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_bundles_asm_id ON public.rider_bundles(asm_id);
CREATE INDEX IF NOT EXISTS idx_rider_bundles_status ON public.rider_bundles(status);
CREATE INDEX IF NOT EXISTS idx_rider_bundles_created_at ON public.rider_bundles(created_at);
CREATE INDEX IF NOT EXISTS idx_rider_bundle_orders_bundle_id ON public.rider_bundle_orders(bundle_id);
CREATE INDEX IF NOT EXISTS idx_rider_bundle_orders_order_id ON public.rider_bundle_orders(order_id);

-- Add comments for documentation
COMMENT ON TABLE public.rider_bundles IS 'Rider bundles containing multiple COD orders with cash denomination breakdown';
COMMENT ON COLUMN public.rider_bundles.denomination_breakdown IS 'JSONB object with denomination counts, e.g., {"2000": 5, "500": 10, "100": 20}';
COMMENT ON COLUMN public.rider_bundles.photo_proofs IS 'Array of Supabase Storage URLs for bundle photo proofs';
COMMENT ON COLUMN public.rider_bundles.status IS 'Bundle lifecycle status: CREATED -> READY_FOR_HANDOVER -> HANDEDOVER_TO_ASM -> INCLUDED_IN_SUPERBUNDLE or REJECTED';
COMMENT ON TABLE public.rider_bundle_orders IS 'Many-to-many mapping between rider bundles and orders';
