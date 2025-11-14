-- Grant execute permissions on get_kpi_metrics function to authenticated users
-- This allows all authenticated users (including ASMs, SMs, etc.) to call the function
-- The function uses SECURITY DEFINER, so it runs with the privileges of the function owner
-- but we still need to grant EXECUTE permission to allow users to call it

GRANT EXECUTE ON FUNCTION public.get_kpi_metrics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_store_id TEXT,
  p_rider_id TEXT,
  p_asm_id TEXT
) TO authenticated;

