-- Restore missing INSERT policies that were dropped in migration 003

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "ASMs can insert their own events" ON public.asm_events;
DROP POLICY IF EXISTS "Riders can insert their own events" ON public.rider_events;
DROP POLICY IF EXISTS "ASMs can insert their own deposits" ON public.deposits;

-- Recreate ASM events INSERT policy
CREATE POLICY "ASMs can insert their own events"
  ON public.asm_events FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) = 'admin' OR
    (get_user_role_safe(auth.uid()) = 'asm' AND asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

-- Recreate rider events INSERT policy
CREATE POLICY "Riders can insert their own events"
  ON public.rider_events FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) = 'admin' OR
    (get_user_role_safe(auth.uid()) = 'rider' AND rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid()))
  );

-- Recreate deposits INSERT policy
CREATE POLICY "ASMs can insert their own deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) = 'admin' OR
    (get_user_role_safe(auth.uid()) = 'asm' AND asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

