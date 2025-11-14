-- Migration 038: Add RLS policies for bundle tables
-- Enables RLS and creates policies for rider_bundles and asm_superbundles

-- Enable RLS on bundle tables
ALTER TABLE public.rider_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_bundle_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asm_superbundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asm_superbundle_bundles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RIDER_BUNDLES POLICIES
-- ============================================================================

-- Riders can view their own bundles
CREATE POLICY "Riders can view their own bundles"
  ON public.rider_bundles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        role = 'finance' OR
        (role = 'rider' AND rider_id = rider_bundles.rider_id) OR
        (role = 'asm' AND asm_id = rider_bundles.asm_id)
      )
    )
  );

-- Riders can create bundles for themselves
CREATE POLICY "Riders can create their own bundles"
  ON public.rider_bundles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        (role = 'rider' AND rider_id = rider_bundles.rider_id)
      )
    )
  );

-- Riders can modify their own bundles until READY_FOR_HANDOVER
-- ASMs can accept/reject bundles assigned to them
-- Admins/Finance can modify any bundle
CREATE POLICY "Users can update bundles based on role and status"
  ON public.rider_bundles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        role = 'finance' OR
        (role = 'rider' AND rider_id = rider_bundles.rider_id AND status IN ('CREATED')) OR
        (role = 'asm' AND asm_id = rider_bundles.asm_id AND status = 'READY_FOR_HANDOVER')
      )
    )
  );

-- ============================================================================
-- RIDER_BUNDLE_ORDERS POLICIES
-- ============================================================================

-- Users can view bundle-order mappings if they can view the bundle
CREATE POLICY "Users can view bundle-order mappings"
  ON public.rider_bundle_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rider_bundles rb
      JOIN public.users u ON u.id = auth.uid()
      WHERE rb.id = rider_bundle_orders.bundle_id AND (
        u.role IN ('admin', 'finance') OR
        (u.role = 'rider' AND rb.rider_id = u.rider_id) OR
        (u.role = 'asm' AND rb.asm_id = u.asm_id)
      )
    )
  );

-- Riders can insert bundle-order mappings for their own bundles
CREATE POLICY "Riders can create bundle-order mappings"
  ON public.rider_bundle_orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rider_bundles rb
      JOIN public.users u ON u.id = auth.uid()
      WHERE rb.id = rider_bundle_orders.bundle_id AND (
        u.role = 'admin' OR
        (u.role = 'rider' AND rb.rider_id = u.rider_id AND rb.status = 'CREATED')
      )
    )
  );

-- ============================================================================
-- ASM_SUPERBUNDLES POLICIES
-- ============================================================================

-- ASMs can view their own superbundles
-- SMs can view superbundles assigned to them
-- Admins/Finance can view all superbundles
CREATE POLICY "Users can view superbundles based on role"
  ON public.asm_superbundles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        role = 'finance' OR
        (role = 'asm' AND asm_id = asm_superbundles.asm_id) OR
        (role = 'sm' AND sm_id = asm_superbundles.sm_id)
      )
    )
  );

-- ASMs can create superbundles for themselves
CREATE POLICY "ASMs can create their own superbundles"
  ON public.asm_superbundles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        (role = 'asm' AND asm_id = asm_superbundles.asm_id)
      )
    )
  );

-- ASMs can modify their own superbundles until HANDEDOVER_TO_SM
-- SMs can accept superbundles assigned to them
-- Admins/Finance can modify any superbundle
CREATE POLICY "Users can update superbundles based on role and status"
  ON public.asm_superbundles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        role = 'finance' OR
        (role = 'asm' AND asm_id = asm_superbundles.asm_id AND status IN ('CREATED', 'READY_FOR_HANDOVER')) OR
        (role = 'sm' AND sm_id = asm_superbundles.sm_id AND status = 'READY_FOR_HANDOVER')
      )
    )
  );

-- ============================================================================
-- ASM_SUPERBUNDLE_BUNDLES POLICIES
-- ============================================================================

-- Users can view superbundle-bundle mappings if they can view the superbundle
CREATE POLICY "Users can view superbundle-bundle mappings"
  ON public.asm_superbundle_bundles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asm_superbundles sb
      JOIN public.users u ON u.id = auth.uid()
      WHERE sb.id = asm_superbundle_bundles.superbundle_id AND (
        u.role IN ('admin', 'finance') OR
        (u.role = 'asm' AND sb.asm_id = u.asm_id) OR
        (u.role = 'sm' AND sb.sm_id = u.sm_id)
      )
    )
  );

-- ASMs can insert superbundle-bundle mappings for their own superbundles
CREATE POLICY "ASMs can create superbundle-bundle mappings"
  ON public.asm_superbundle_bundles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.asm_superbundles sb
      JOIN public.users u ON u.id = auth.uid()
      WHERE sb.id = asm_superbundle_bundles.superbundle_id AND (
        u.role = 'admin' OR
        (u.role = 'asm' AND sb.asm_id = u.asm_id AND sb.status = 'CREATED')
      )
    )
  );

-- ============================================================================
-- UPDATE ORDERS POLICIES (to respect bundle relationships)
-- ============================================================================

-- Note: Existing orders policies should already handle bundle relationships
-- through the bundle_id and superbundle_id foreign keys. No changes needed
-- as the policies check rider_id and asm_id which are preserved in bundles.

-- Add comments
COMMENT ON POLICY "Riders can view their own bundles" ON public.rider_bundles IS 'Riders see their bundles, ASMs see bundles assigned to them, Admins/Finance see all';
COMMENT ON POLICY "Riders can create their own bundles" ON public.rider_bundles IS 'Only riders can create bundles for themselves, admins can create any bundle';
COMMENT ON POLICY "Users can update bundles based on role and status" ON public.rider_bundles IS 'Riders can modify CREATED bundles, ASMs can accept/reject READY_FOR_HANDOVER bundles';
COMMENT ON POLICY "ASMs can create their own superbundles" ON public.asm_superbundles IS 'Only ASMs can create superbundles for themselves, admins can create any superbundle';
COMMENT ON POLICY "Users can update superbundles based on role and status" ON public.asm_superbundles IS 'ASMs can modify CREATED/READY_FOR_HANDOVER superbundles, SMs can accept READY_FOR_HANDOVER superbundles';
