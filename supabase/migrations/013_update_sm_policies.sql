-- Update RLS policies to include Supply Manager (SM) role access

-- Orders select policy
DROP POLICY IF EXISTS "Users can view orders based on role" ON public.orders;

CREATE POLICY "Users can view orders based on role"
  ON public.orders FOR SELECT
  USING (
    -- Allow all non-test orders for authenticated users
    is_test = false
    OR get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'viewer', 'sm')
    OR (rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid()))
    OR (asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

-- Deposits select policy
DROP POLICY IF EXISTS "Users can view deposits" ON public.deposits;

CREATE POLICY "Users can view deposits"
  ON public.deposits FOR SELECT
  USING (
    get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'viewer', 'sm')
    OR asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid())
  );

-- Deposits insert policy
DROP POLICY IF EXISTS "ASMs can insert their own deposits" ON public.deposits;

CREATE POLICY "Managers can insert deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) IN ('admin', 'sm')
    OR (get_user_role_safe(auth.uid()) = 'asm' AND asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

-- Deposit orders select policy
DROP POLICY IF EXISTS "Users can view deposit orders" ON public.deposit_orders;

CREATE POLICY "Users can view deposit orders"
  ON public.deposit_orders FOR SELECT
  USING (
    get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'viewer', 'sm')
    OR deposit_id IN (
      SELECT d.id FROM public.deposits d
      WHERE d.asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Deposit orders insert policy
DROP POLICY IF EXISTS "Users can insert deposit orders" ON public.deposit_orders;

CREATE POLICY "Managers can insert deposit orders"
  ON public.deposit_orders FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) IN ('admin', 'sm')
  );


