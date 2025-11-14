-- Fix missing INSERT policy for asm_events table
-- This was dropped in migration 003 but not recreated

DROP POLICY IF EXISTS "ASMs can insert their own events" ON public.asm_events;

CREATE POLICY "ASMs can insert their own events"
  ON public.asm_events FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) = 'admin' OR
    (get_user_role_safe(auth.uid()) = 'asm' AND asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

-- Also fix rider_events INSERT policy for consistency
DROP POLICY IF EXISTS "Riders can insert their own events" ON public.rider_events;

CREATE POLICY "Riders can insert their own events"
  ON public.rider_events FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) = 'admin' OR
    (get_user_role_safe(auth.uid()) = 'rider' AND rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid()))
  );

-- Also fix deposits INSERT policy for consistency
DROP POLICY IF EXISTS "ASMs can insert their own deposits" ON public.deposits;

CREATE POLICY "ASMs can insert their own deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (
    get_user_role_safe(auth.uid()) = 'admin' OR
    (get_user_role_safe(auth.uid()) = 'asm' AND asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

