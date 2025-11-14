-- Migration 040: Data migration strategy for existing orders
-- This migration provides functions and strategies for migrating existing orders to the bundle system

-- Function to create retrospective bundles for orders in COLLECTED_BY_RIDER state
-- This is optional and should be feature-flagged
CREATE OR REPLACE FUNCTION create_retrospective_bundles(
  p_rider_id TEXT,
  p_asm_id TEXT DEFAULT NULL,
  p_batch_size INTEGER DEFAULT 50
)
RETURNS TABLE(
  bundle_id UUID,
  orders_count INTEGER,
  total_amount DECIMAL(12, 2)
) AS $$
DECLARE
  v_order_record RECORD;
  v_bundle_id UUID;
  v_orders_in_bundle UUID[] := ARRAY[]::UUID[];
  v_total_amount DECIMAL(12, 2) := 0;
  v_denomination_breakdown JSONB := '{}'::JSONB;
BEGIN
  -- Only process if feature flag is enabled
  IF NOT EXISTS (
    SELECT 1 FROM public.feature_flags
    WHERE flag_key = 'enable_retrospective_bundles'
    AND (flag_value->>'enabled')::boolean = true
  ) THEN
    RAISE EXCEPTION 'Retrospective bundle creation is not enabled';
  END IF;

  -- Process orders in batches
  FOR v_order_record IN
    SELECT id, collected_amount, cod_amount, rider_id
    FROM public.orders
    WHERE rider_id = p_rider_id
      AND payment_type = 'COD'
      AND cod_type IN ('COD_HARD', 'COD_QR')
      AND money_state = 'COLLECTED_BY_RIDER'
      AND bundle_id IS NULL
      AND collected_at IS NOT NULL
    ORDER BY collected_at ASC
    LIMIT p_batch_size
  LOOP
    -- Add order to current batch
    v_orders_in_bundle := array_append(v_orders_in_bundle, v_order_record.id);
    v_total_amount := v_total_amount + COALESCE(v_order_record.collected_amount, v_order_record.cod_amount, 0);

    -- When batch is full, create bundle
    IF array_length(v_orders_in_bundle, 1) >= p_batch_size THEN
      -- Create bundle with estimated denomination breakdown
      -- Note: This is a simplified breakdown - in production, you'd want more sophisticated logic
      INSERT INTO public.rider_bundles (
        rider_id,
        asm_id,
        expected_amount,
        denomination_breakdown,
        status,
        digital_signoff,
        metadata
      ) VALUES (
        p_rider_id,
        p_asm_id,
        v_total_amount,
        jsonb_build_object('estimated', true),
        'CREATED',
        false,
        jsonb_build_object('retrospective', true, 'created_at', NOW())
      )
      RETURNING id INTO v_bundle_id;

      -- Link orders to bundle
      INSERT INTO public.rider_bundle_orders (bundle_id, order_id)
      SELECT v_bundle_id, unnest(v_orders_in_bundle);

      -- Update orders
      UPDATE public.orders
      SET bundle_id = v_bundle_id,
          money_state = 'BUNDLED',
          updated_at = NOW()
      WHERE id = ANY(v_orders_in_bundle);

      -- Return bundle info
      RETURN QUERY SELECT v_bundle_id, array_length(v_orders_in_bundle, 1), v_total_amount;

      -- Reset for next batch
      v_orders_in_bundle := ARRAY[]::UUID[];
      v_total_amount := 0;
    END IF;
  END LOOP;

  -- Handle remaining orders
  IF array_length(v_orders_in_bundle, 1) > 0 THEN
    INSERT INTO public.rider_bundles (
      rider_id,
      asm_id,
      expected_amount,
      denomination_breakdown,
      status,
      digital_signoff,
      metadata
    ) VALUES (
      p_rider_id,
      p_asm_id,
      v_total_amount,
      jsonb_build_object('estimated', true),
      'CREATED',
      false,
      jsonb_build_object('retrospective', true, 'created_at', NOW())
    )
    RETURNING id INTO v_bundle_id;

    INSERT INTO public.rider_bundle_orders (bundle_id, order_id)
    SELECT v_bundle_id, unnest(v_orders_in_bundle);

    UPDATE public.orders
    SET bundle_id = v_bundle_id,
        money_state = 'BUNDLED',
        updated_at = NOW()
    WHERE id = ANY(v_orders_in_bundle);

    RETURN QUERY SELECT v_bundle_id, array_length(v_orders_in_bundle, 1), v_total_amount;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark legacy orders (already in HANDOVER_TO_ASM without bundles)
CREATE OR REPLACE FUNCTION mark_legacy_orders()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.orders
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('legacy', true, 'legacy_marked_at', NOW())
  WHERE payment_type = 'COD'
    AND cod_type IN ('COD_HARD', 'COD_QR')
    AND money_state = 'HANDOVER_TO_ASM'
    AND bundle_id IS NULL
    AND (metadata->>'legacy')::boolean IS DISTINCT FROM true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_retrospective_bundles(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_legacy_orders() TO authenticated;

-- Add comments
COMMENT ON FUNCTION create_retrospective_bundles(TEXT, TEXT, INTEGER) IS 'Creates retrospective bundles for existing COLLECTED_BY_RIDER orders (feature-flagged)';
COMMENT ON FUNCTION mark_legacy_orders() IS 'Marks existing HANDOVER_TO_ASM orders without bundles as legacy for backward compatibility';

-- Run legacy marking (safe to run multiple times)
SELECT mark_legacy_orders() as legacy_orders_marked;
