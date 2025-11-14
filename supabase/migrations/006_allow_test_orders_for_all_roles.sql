-- Update RLS policy to allow all authenticated users to view test orders
-- This allows simulator/test data to be visible to all roles

DROP POLICY IF EXISTS "Users can view orders based on role" ON public.orders;

CREATE POLICY "Users can view orders based on role"
  ON public.orders FOR SELECT
  USING (
    -- Allow all authenticated users to see all orders (including test orders)
    -- Test orders are marked with a badge in the UI for clarity
    auth.uid() IS NOT NULL AND
    (
      -- Admins, finance, and viewers can see everything
      get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'viewer') OR
      -- Riders can see orders assigned to them OR all test orders
      (rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid())) OR
      (is_test = true AND get_user_role_safe(auth.uid()) = 'rider') OR
      -- ASMs can see orders assigned to them OR all test orders
      (asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid())) OR
      (is_test = true AND get_user_role_safe(auth.uid()) = 'asm') OR
      -- Non-test orders visible to all authenticated users
      is_test = false
    )
  );

