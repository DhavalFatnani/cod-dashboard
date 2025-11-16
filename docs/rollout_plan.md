# Migration & Rollout Plan

- Dev → Staging → Pilot (1 city/1 ASM) → Full rollout
- Non-destructive migrations with rollback scripts under `migrations/scripts`
- Feature flags to gate API endpoints by role
- Backout: run `rollback.sql`, disable new endpoints, restore from backups
- Monitoring: track unbundled amounts, pending bundles, recon exceptions
