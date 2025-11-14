-- Fix infinite recursion in RLS policies
-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view orders based on role" ON public.orders;
DROP POLICY IF EXISTS "Users can view rider events" ON public.rider_events;
DROP POLICY IF EXISTS "Users can view ASM events" ON public.asm_events;
DROP POLICY IF EXISTS "Users can view deposits" ON public.deposits;

-- Create a SECURITY DEFINER function to check user role without RLS recursion
CREATE OR REPLACE FUNCTION get_user_role_safe(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate users policy without recursion
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (get_user_role_safe(auth.uid()) = 'admin');

-- Recreate orders policy without recursion
CREATE POLICY "Users can view orders based on role"
  ON public.orders FOR SELECT
  USING (
    is_test = false OR
    get_user_role_safe(auth.uid()) = 'admin' OR
    (rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid())) OR
    (asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

-- Recreate rider_events policy without recursion
CREATE POLICY "Users can view rider events"
  ON public.rider_events FOR SELECT
  USING (
    get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'viewer') OR
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = rider_events.order_id AND (
        o.rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid()) OR
        o.asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

-- Recreate asm_events policy without recursion
CREATE POLICY "Users can view ASM events"
  ON public.asm_events FOR SELECT
  USING (
    get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'viewer') OR
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = asm_events.order_id AND (
        o.rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid()) OR
        o.asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

-- Recreate deposits policy without recursion
CREATE POLICY "Users can view deposits"
  ON public.deposits FOR SELECT
  USING (
    get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'viewer') OR
    (asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

