-- Migration 035: Add bundle fields to orders and extend money_state enum
-- Adds bundle_id, superbundle_id to orders table and new money_state values

-- Add new values to money_state enum
-- Note: ALTER TYPE ... ADD VALUE cannot be rolled back, but we check if values exist first
DO $$
BEGIN
  -- Add BUNDLED state
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'BUNDLED' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'money_state')
  ) THEN
    ALTER TYPE money_state ADD VALUE 'BUNDLED';
  END IF;
  
  -- Add READY_FOR_HANDOVER state
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'READY_FOR_HANDOVER' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'money_state')
  ) THEN
    ALTER TYPE money_state ADD VALUE 'READY_FOR_HANDOVER';
  END IF;
  
  -- Add INCLUDED_IN_SUPERBUNDLE state
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'INCLUDED_IN_SUPERBUNDLE' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'money_state')
  ) THEN
    ALTER TYPE money_state ADD VALUE 'INCLUDED_IN_SUPERBUNDLE';
  END IF;
END $$;

-- Add bundle_id and superbundle_id columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES public.rider_bundles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superbundle_id UUID REFERENCES public.asm_superbundles(id) ON DELETE SET NULL;

-- Create indexes for bundle relationships
CREATE INDEX IF NOT EXISTS idx_orders_bundle_id ON public.orders(bundle_id);
CREATE INDEX IF NOT EXISTS idx_orders_superbundle_id ON public.orders(superbundle_id);

-- Add comments
COMMENT ON COLUMN public.orders.bundle_id IS 'Reference to rider_bundles table when order is included in a bundle';
COMMENT ON COLUMN public.orders.superbundle_id IS 'Reference to asm_superbundles table when order is included in a superbundle (via bundle)';
