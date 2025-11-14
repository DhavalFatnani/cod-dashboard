# Bundle System Alert Rules

## Overview
Alert rules for monitoring bundle system health and identifying issues.

## High Priority Alerts

### 1. High Unbundled Amount
**Metric**: Rider Unbundled Amount per ASM
**Threshold**: > ₹50,000
**Frequency**: Every 15 minutes
**Action**: 
- Send Slack alert to ASM and ops team
- Email ASM manager
- Create ticket for follow-up

**Query**:
```sql
SELECT asm_id, SUM(collected_amount) as unbundled_amount
FROM orders
WHERE bundle_id IS NULL
  AND money_state = 'COLLECTED_BY_RIDER'
  AND payment_type = 'COD'
GROUP BY asm_id
HAVING SUM(collected_amount) > 50000;
```

### 2. Critical SLA Violations
**Metric**: Orders unbundled > 120 minutes
**Threshold**: > 20 orders
**Frequency**: Every 30 minutes
**Action**:
- Send Slack alert
- Email ops team
- Escalate to management if > 50 orders

**Query**:
```sql
SELECT COUNT(*) as violation_count
FROM orders
WHERE bundle_id IS NULL
  AND money_state = 'COLLECTED_BY_RIDER'
  AND collected_at < NOW() - INTERVAL '120 minutes';
```

## Medium Priority Alerts

### 3. Daily SLA Breaches
**Metric**: Orders with unbundled time > 60 minutes per day
**Threshold**: > 10 orders per day
**Frequency**: Daily at 6 PM
**Action**:
- Send daily summary email
- Include in daily ops report

**Query**:
```sql
SELECT COUNT(*) as daily_violations
FROM orders
WHERE bundle_id IS NULL
  AND money_state = 'COLLECTED_BY_RIDER'
  AND collected_at < NOW() - INTERVAL '60 minutes'
  AND collected_at >= CURRENT_DATE;
```

### 4. Bundles Pending Handover
**Metric**: Bundles in READY_FOR_HANDOVER > 24 hours
**Threshold**: > 5 bundles
**Frequency**: Every 2 hours
**Action**:
- Send Slack reminder to ASM
- Include in ASM dashboard

**Query**:
```sql
SELECT COUNT(*) as pending_bundles
FROM rider_bundles
WHERE status = 'READY_FOR_HANDOVER'
  AND sealed_at < NOW() - INTERVAL '24 hours';
```

### 5. SuperBundles Pending SM Handover
**Metric**: SuperBundles in READY_FOR_HANDOVER > 48 hours
**Threshold**: > 3 superbundles
**Frequency**: Every 4 hours
**Action**:
- Send Slack alert to SM
- Email SM manager

**Query**:
```sql
SELECT COUNT(*) as pending_superbundles
FROM asm_superbundles
WHERE status = 'READY_FOR_HANDOVER'
  AND sealed_at < NOW() - INTERVAL '48 hours';
```

## Low Priority Alerts

### 6. Deposit Amount Mismatch
**Metric**: Deposit validation_status = MISMATCH
**Threshold**: Mismatch > ₹1,000
**Frequency**: Real-time (on deposit creation)
**Action**:
- Log to audit trail
- Send email to finance team
- Require manual review

**Query**:
```sql
SELECT id, deposit_number, expected_amount, actual_amount_received,
       ABS(expected_amount - actual_amount_received) as mismatch
FROM deposits
WHERE validation_status = 'MISMATCH'
  AND ABS(expected_amount - actual_amount_received) > 1000;
```

### 7. Bundle Rejection Rate
**Metric**: % of bundles rejected by ASM
**Threshold**: > 10% rejection rate (daily)
**Frequency**: Daily summary
**Action**:
- Include in daily report
- Review rejection reasons

**Query**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'REJECTED') * 100.0 / COUNT(*) as rejection_rate
FROM rider_bundles
WHERE created_at >= CURRENT_DATE;
```

### 8. Photo Upload Failures
**Metric**: Failed photo uploads
**Threshold**: > 5 failures per hour
**Frequency**: Hourly
**Action**:
- Check storage bucket health
- Verify file size limits
- Review error logs

## Alert Channels

### Slack Integration
- **Channel**: #cod-dashboard-alerts
- **Format**: JSON webhook
- **Severity Colors**: 
  - High: Red
  - Medium: Yellow
  - Low: Blue

### Email Integration
- **Recipients**: 
  - High: ops-team@company.com, asm-managers@company.com
  - Medium: ops-team@company.com
  - Low: ops-team@company.com (daily digest)
- **Frequency**: 
  - High: Immediate
  - Medium: Batched (every 2 hours)
  - Low: Daily digest

## Alert Suppression

### Business Hours
- Suppress low priority alerts outside business hours (9 AM - 6 PM)
- High priority alerts always sent

### Maintenance Windows
- Suppress alerts during scheduled maintenance
- Resume after maintenance completion

## Alert Testing

### Weekly Tests
- [ ] Test all alert queries
- [ ] Verify Slack webhook
- [ ] Verify email delivery
- [ ] Check alert accuracy

### Monthly Review
- [ ] Review alert thresholds
- [ ] Adjust based on trends
- [ ] Remove false positives
- [ ] Add new alerts if needed

## Metrics Dashboard

### Real-time Metrics
- Unbundled amount (per ASM)
- Pending bundles count
- Pending superbundles count
- SLA violations count

### Historical Trends
- Daily unbundled amount trend
- Bundle creation rate
- Rejection rate trend
- Deposit mismatch frequency

## Escalation Path

1. **Level 1**: Automated alert to ops team
2. **Level 2**: If no response in 30 min → Escalate to manager
3. **Level 3**: If critical and unresolved → Escalate to director
4. **Level 4**: If system-wide issue → Escalate to CTO

## Alert Response Playbook

### High Unbundled Amount
1. Contact ASM immediately
2. Review rider activity
3. Check for system issues
4. Document resolution

### SLA Violations
1. Identify affected riders
2. Send reminders
3. Escalate if persistent
4. Review process improvements

### Deposit Mismatches
1. Verify deposit slip
2. Check superbundle amounts
3. Reconcile with bank
4. Update records
