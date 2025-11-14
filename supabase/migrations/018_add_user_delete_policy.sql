-- Add DELETE policy for users to delete their own profile
-- This is needed for phone-only auth migration where profiles need to be recreated with auth user ID

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;

CREATE POLICY "Users can delete their own profile"
  ON public.users FOR DELETE
  USING (
    auth.uid() = id OR 
    phone IN (SELECT phone FROM auth.users WHERE id = auth.uid())
  );

