# Supabase Edge Functions — Pseudocode

## seal_rider_bundle

```
Input: { bundle_id, idempotency_key }
BEGIN;
  ensure_idempotent(idempotency_key);
  b := select * from rider_bundles where id = bundle_id for update;
  if b.sealed then return;
  update rider_bundles set sealed = true where id = bundle_id;
  insert into audit_events (...);
COMMIT;
Return 200
```

## create_superbundle

```
Input: { asm_id, rider_bundle_ids[], idempotency_key }
BEGIN;
  ensure_idempotent(idempotency_key);
  sb := insert into asm_superbundles (asm_id) values ($1) returning id;
  foreach bundle_id in rider_bundle_ids loop
    insert into asm_superbundle_bundles values (sb.id, bundle_id);
  end loop;
  insert into audit_events (...);
COMMIT;
Return { id: sb.id }
```

## reconcile_deposit

```
Input: { deposit_id, amount, bank_txn_id, idempotency_key }
BEGIN;
  ensure_idempotent(idempotency_key);
  lock row deposit_bundles where id = deposit_id;
  -- compare sums and set status
  insert into audit_events (...);
COMMIT;
```
