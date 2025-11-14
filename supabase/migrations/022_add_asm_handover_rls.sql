-- Add RLS policies for asm_handover_data table

ALTER TABLE public.asm_handover_data ENABLE ROW LEVEL SECURITY;

-- ASMs can view their own handover data
DROP POLICY IF EXISTS "ASMs can view their own handover data" ON public.asm_handover_data;
CREATE POLICY "ASMs can view their own handover data"
  ON public.asm_handover_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        get_user_role_safe(auth.uid()) = 'admin' OR
        (get_user_role_safe(auth.uid()) = 'asm' AND asm_id = asm_handover_data.asm_id)
      )
    )
  );

-- ASMs can insert their own handover data
DROP POLICY IF EXISTS "ASMs can insert their own handover data" ON public.asm_handover_data;
CREATE POLICY "ASMs can insert their own handover data"
  ON public.asm_handover_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        get_user_role_safe(auth.uid()) = 'admin' OR
        (get_user_role_safe(auth.uid()) = 'asm' AND asm_id = asm_handover_data.asm_id)
      )
    )
  );

-- ASMs can update their own handover data (before submission)
DROP POLICY IF EXISTS "ASMs can update their own handover data" ON public.asm_handover_data;
CREATE POLICY "ASMs can update their own handover data"
  ON public.asm_handover_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        get_user_role_safe(auth.uid()) = 'admin' OR
        (get_user_role_safe(auth.uid()) = 'asm' AND asm_id = asm_handover_data.asm_id AND status = 'PENDING')
      )
    )
  );

-- SMs can view handover data for ASMs they collect from
DROP POLICY IF EXISTS "SMs can view handover data" ON public.asm_handover_data;
CREATE POLICY "SMs can view handover data"
  ON public.asm_handover_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        get_user_role_safe(auth.uid()) IN ('admin', 'finance', 'sm')
      )
    )
  );

-- SMs can update handover data (for validation)
DROP POLICY IF EXISTS "SMs can update handover data" ON public.asm_handover_data;
CREATE POLICY "SMs can update handover data"
  ON public.asm_handover_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        get_user_role_safe(auth.uid()) IN ('admin', 'sm')
      )
    )
  );

-- Admins and Finance can view all handover data
-- (Already covered by SM policy above, but explicit for clarity)

