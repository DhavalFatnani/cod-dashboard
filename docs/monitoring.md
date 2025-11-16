# Metrics, Alerts, and Runbooks

## Metrics
- Unbundled amount (by ASM, by city)
- Pending rider bundles count
- Superbundles awaiting SM
- Deposits pending reconciliation
- Reconciliation variance

## Alerts
- Rider bundling SLA > 60 min
- ASM accept SLA > 120 min
- Deposit > 24h pending
- Any reconciliation variance > threshold

## Runbooks
- Investigate stuck bundles: trace order → bundle → superbundle → deposit
- Reconciliation mismatch: pull bank txns, recompute expected vs actual, annotate audit trail
- Backfill policies/migrations: run dry-run, apply, verify KPIs
