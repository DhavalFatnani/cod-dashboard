-- Seed representative rows
BEGIN;

INSERT INTO orders (order_code, rider_id, amount_cents, money_state)
VALUES
 ('ORD-1001', gen_random_uuid(), 15000, 'uncollected')
,('ORD-1002', gen_random_uuid(), 25000, 'collected_unbundled')
,('ORD-1003', gen_random_uuid(), 5000,  'uncollected')
ON CONFLICT (order_code) DO NOTHING;

-- Create a rider bundle and link orders
WITH rb AS (
  INSERT INTO rider_bundles (rider_id) VALUES (gen_random_uuid()) RETURNING id
)
INSERT INTO rider_bundle_orders (bundle_id, order_id, amount_cents)
SELECT rb.id, o.id, o.amount_cents FROM rb, orders o WHERE o.order_code IN ('ORD-1002');

COMMIT;
