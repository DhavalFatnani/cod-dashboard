-- Migration 036: Add bundle ledger functions
-- Creates get_rider_ledger() and get_asm_ledger() functions for aggregation

-- Function to get rider ledger (collected, bundled, unbundled amounts)
CREATE OR REPLACE FUNCTION get_rider_ledger(
  p_rider_id TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  rider_id TEXT,
  rider_name TEXT,
  collected_amount DECIMAL(12, 2),
  bundled_amount DECIMAL(12, 2),
  unbundled_amount DECIMAL(12, 2),
  bundled_count INTEGER,
  unbundled_count INTEGER,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH date_filter AS (
    SELECT 
      COALESCE(p_start_date, NOW() - INTERVAL '30 days') as start_dt,
      COALESCE(p_end_date, NOW()) as end_dt
  ),
  collected_orders AS (
    SELECT 
      o.rider_id,
      o.rider_name,
      COALESCE(SUM(o.collected_amount), 0) as collected_amt,
      COUNT(*) as collected_cnt
    FROM public.orders o, date_filter df
    WHERE o.rider_id = p_rider_id
      AND o.payment_type = 'COD'
      AND o.cod_type IN ('COD_HARD', 'COD_QR')
      AND o.money_state IN ('COLLECTED_BY_RIDER', 'BUNDLED', 'READY_FOR_HANDOVER', 'HANDOVER_TO_ASM', 'INCLUDED_IN_SUPERBUNDLE', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED')
      AND o.collected_at >= df.start_dt
      AND o.collected_at <= df.end_dt
    GROUP BY o.rider_id, o.rider_name
  ),
  bundled_orders AS (
    SELECT 
      o.rider_id,
      o.rider_name,
      COALESCE(SUM(o.collected_amount), 0) as bundled_amt,
      COUNT(*) as bundled_cnt
    FROM public.orders o, date_filter df
    WHERE o.rider_id = p_rider_id
      AND o.payment_type = 'COD'
      AND o.cod_type IN ('COD_HARD', 'COD_QR')
      AND o.bundle_id IS NOT NULL
      AND o.money_state IN ('BUNDLED', 'READY_FOR_HANDOVER', 'HANDOVER_TO_ASM', 'INCLUDED_IN_SUPERBUNDLE', 'PENDING_TO_DEPOSIT', 'DEPOSITED', 'RECONCILED')
      AND o.collected_at >= df.start_dt
      AND o.collected_at <= df.end_dt
    GROUP BY o.rider_id, o.rider_name
  ),
  unbundled_orders AS (
    SELECT 
      o.rider_id,
      o.rider_name,
      COALESCE(SUM(o.collected_amount), 0) as unbundled_amt,
      COUNT(*) as unbundled_cnt
    FROM public.orders o, date_filter df
    WHERE o.rider_id = p_rider_id
      AND o.payment_type = 'COD'
      AND o.cod_type IN ('COD_HARD', 'COD_QR')
      AND o.bundle_id IS NULL
      AND o.money_state = 'COLLECTED_BY_RIDER'
      AND o.collected_at >= df.start_dt
      AND o.collected_at <= df.end_dt
    GROUP BY o.rider_id, o.rider_name
  )
  SELECT 
    COALESCE(c.rider_id, b.rider_id, u.rider_id) as rider_id,
    COALESCE(c.rider_name, b.rider_name, u.rider_name) as rider_name,
    COALESCE(c.collected_amt, 0) as collected_amount,
    COALESCE(b.bundled_amt, 0) as bundled_amount,
    COALESCE(u.unbundled_amt, 0) as unbundled_amount,
    COALESCE(b.bundled_cnt, 0)::INTEGER as bundled_count,
    COALESCE(u.unbundled_cnt, 0)::INTEGER as unbundled_count,
    (SELECT start_dt FROM date_filter) as date_range_start,
    (SELECT end_dt FROM date_filter) as date_range_end
  FROM collected_orders c
  FULL OUTER JOIN bundled_orders b ON c.rider_id = b.rider_id
  FULL OUTER JOIN unbundled_orders u ON COALESCE(c.rider_id, b.rider_id) = u.rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get ASM ledger (bundle counts, superbundle counts, pending)
CREATE OR REPLACE FUNCTION get_asm_ledger(
  p_asm_id TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  asm_id TEXT,
  asm_name TEXT,
  bundles_pending_count INTEGER,
  bundles_pending_amount DECIMAL(12, 2),
  bundles_accepted_count INTEGER,
  bundles_accepted_amount DECIMAL(12, 2),
  bundles_rejected_count INTEGER,
  superbundles_pending_count INTEGER,
  superbundles_pending_amount DECIMAL(12, 2),
  superbundles_handedover_count INTEGER,
  superbundles_handedover_amount DECIMAL(12, 2),
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH date_filter AS (
    SELECT 
      COALESCE(p_start_date, NOW() - INTERVAL '30 days') as start_dt,
      COALESCE(p_end_date, NOW()) as end_dt
  ),
  bundles_pending AS (
    SELECT 
      rb.asm_id,
      rb.asm_name,
      COUNT(*) as bundle_cnt,
      COALESCE(SUM(rb.expected_amount), 0) as bundle_amt
    FROM public.rider_bundles rb, date_filter df
    WHERE rb.asm_id = p_asm_id
      AND rb.status = 'READY_FOR_HANDOVER'
      AND rb.created_at >= df.start_dt
      AND rb.created_at <= df.end_dt
    GROUP BY rb.asm_id, rb.asm_name
  ),
  bundles_accepted AS (
    SELECT 
      rb.asm_id,
      rb.asm_name,
      COUNT(*) as bundle_cnt,
      COALESCE(SUM(rb.expected_amount), 0) as bundle_amt
    FROM public.rider_bundles rb, date_filter df
    WHERE rb.asm_id = p_asm_id
      AND rb.status = 'HANDEDOVER_TO_ASM'
      AND rb.handedover_at >= df.start_dt
      AND rb.handedover_at <= df.end_dt
    GROUP BY rb.asm_id, rb.asm_name
  ),
  bundles_rejected AS (
    SELECT 
      rb.asm_id,
      rb.asm_name,
      COUNT(*) as bundle_cnt
    FROM public.rider_bundles rb, date_filter df
    WHERE rb.asm_id = p_asm_id
      AND rb.status = 'REJECTED'
      AND rb.rejected_at >= df.start_dt
      AND rb.rejected_at <= df.end_dt
    GROUP BY rb.asm_id, rb.asm_name
  ),
  superbundles_pending AS (
    SELECT 
      sb.asm_id,
      sb.asm_name,
      COUNT(*) as superbundle_cnt,
      COALESCE(SUM(sb.expected_amount), 0) as superbundle_amt
    FROM public.asm_superbundles sb, date_filter df
    WHERE sb.asm_id = p_asm_id
      AND sb.status = 'READY_FOR_HANDOVER'
      AND sb.created_at >= df.start_dt
      AND sb.created_at <= df.end_dt
    GROUP BY sb.asm_id, sb.asm_name
  ),
  superbundles_handedover AS (
    SELECT 
      sb.asm_id,
      sb.asm_name,
      COUNT(*) as superbundle_cnt,
      COALESCE(SUM(sb.expected_amount), 0) as superbundle_amt
    FROM public.asm_superbundles sb, date_filter df
    WHERE sb.asm_id = p_asm_id
      AND sb.status = 'HANDEDOVER_TO_SM'
      AND sb.handedover_at >= df.start_dt
      AND sb.handedover_at <= df.end_dt
    GROUP BY sb.asm_id, sb.asm_name
  )
  SELECT 
    COALESCE(bp.asm_id, ba.asm_id, br.asm_id, sp.asm_id, sh.asm_id) as asm_id,
    COALESCE(bp.asm_name, ba.asm_name, br.asm_name, sp.asm_name, sh.asm_name) as asm_name,
    COALESCE(bp.bundle_cnt, 0)::INTEGER as bundles_pending_count,
    COALESCE(bp.bundle_amt, 0) as bundles_pending_amount,
    COALESCE(ba.bundle_cnt, 0)::INTEGER as bundles_accepted_count,
    COALESCE(ba.bundle_amt, 0) as bundles_accepted_amount,
    COALESCE(br.bundle_cnt, 0)::INTEGER as bundles_rejected_count,
    COALESCE(sp.superbundle_cnt, 0)::INTEGER as superbundles_pending_count,
    COALESCE(sp.superbundle_amt, 0) as superbundles_pending_amount,
    COALESCE(sh.superbundle_cnt, 0)::INTEGER as superbundles_handedover_count,
    COALESCE(sh.superbundle_amt, 0) as superbundles_handedover_amount,
    (SELECT start_dt FROM date_filter) as date_range_start,
    (SELECT end_dt FROM date_filter) as date_range_end
  FROM bundles_pending bp
  FULL OUTER JOIN bundles_accepted ba ON bp.asm_id = ba.asm_id
  FULL OUTER JOIN bundles_rejected br ON COALESCE(bp.asm_id, ba.asm_id) = br.asm_id
  FULL OUTER JOIN superbundles_pending sp ON COALESCE(bp.asm_id, ba.asm_id, br.asm_id) = sp.asm_id
  FULL OUTER JOIN superbundles_handedover sh ON COALESCE(bp.asm_id, ba.asm_id, br.asm_id, sp.asm_id) = sh.asm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_rider_ledger(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_asm_ledger(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_rider_ledger(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns aggregated ledger for a rider: collected, bundled, and unbundled amounts';
COMMENT ON FUNCTION get_asm_ledger(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns aggregated ledger for an ASM: bundle counts, superbundle counts, and pending amounts';
