# ASM SuperBundles User Guide

## Overview
This guide explains how ASMs can accept rider bundles and create superbundles for SM deposit.

## Accepting Rider Bundles

### Step 1: View Pending Bundles
1. Navigate to **ASM Handover** page
2. View **Bundled Orders** panel
3. See bundles in `READY_FOR_HANDOVER` status
4. Click bundle to view details

### Step 2: Validate Bundle
1. Review bundle details:
   - Expected amount
   - Denomination breakdown
   - Included orders
   - Photo proofs
2. Physically verify cash
3. Count actual denominations

### Step 3: Accept or Reject

#### Accepting:
1. Click **Accept Bundle**
2. Enter actual denominations (if different from expected)
3. Add comments (optional)
4. Click **Accept**
5. Bundle status → `HANDEDOVER_TO_ASM`

#### Rejecting:
1. Click **Reject Bundle**
2. Enter rejection reason (required)
3. Add comments
4. Click **Reject**
5. Bundle status → `REJECTED`
6. Rider notified

## Creating SuperBundles

### Step 1: Select Bundles
1. View **Bundled Orders** panel
2. Select multiple bundles in `HANDEDOVER_TO_ASM` status
3. Click **Create SuperBundle**

### Step 2: Review Aggregation
1. System auto-aggregates denominations
2. Review total expected amount
3. Verify denomination breakdown

**Example**:
- Bundle 1: ₹2000×5, ₹500×10 = ₹15,000
- Bundle 2: ₹2000×3, ₹500×5 = ₹10,000
- SuperBundle: ₹2000×8, ₹500×15 = ₹25,000

### Step 3: Confirm and Create
1. Verify aggregated denominations
2. Check digital signoff
3. Click **Create SuperBundle**
4. SuperBundle status → `CREATED`

### Step 4: Mark Ready for SM
1. Review superbundle details
2. Click **Mark Ready for Handover**
3. SuperBundle status → `READY_FOR_HANDOVER`
4. SM can now accept it

## Rider Summary Cards

### Viewing Rider Performance
1. See **Rider Summary Cards** on ASM Handover page
2. Each card shows:
   - Collected amount
   - Bundled amount
   - Unbundled amount (highlighted if > 0)
3. Red highlight indicates action needed

### Unbundled Orders
1. View **Unbundled Orders** table
2. See orders in `COLLECTED_BY_RIDER` without bundles
3. Click **Ask Justification** to request reason from rider
4. Track unbundled time (SLA violations)

## Requesting Justification

### Step 1: Identify Unbundled Order
1. View **Unbundled Orders** table
2. Find order needing justification
3. Click **Ask Justification**

### Step 2: Send Message
1. Enter message to rider
2. Click **Send**
3. Rider receives notification
4. Order updated with `unbundled_reason`

### Step 3: Review Response
1. Rider responds with justification
2. Review in order details
3. Take appropriate action

## SuperBundle Statuses

1. **CREATED**: Just created, can be modified
2. **READY_FOR_HANDOVER**: Ready for SM
3. **HANDEDOVER_TO_SM**: Accepted by SM
4. **INCLUDED_IN_DEPOSIT**: Part of deposit
5. **REJECTED**: Rejected by SM

## Best Practices

1. **Accept promptly**: Don't delay bundle acceptance
2. **Verify carefully**: Count actual denominations
3. **Document discrepancies**: Add comments if amounts differ
4. **Create superbundles regularly**: Don't accumulate bundles
5. **Monitor unbundled orders**: Follow up with riders
6. **Request justification**: For orders unbundled > 60 minutes

## Common Issues

### "Bundle not assigned to this ASM"
- **Cause**: Bundle assigned to different ASM
- **Solution**: Contact admin to reassign

### "Denomination mismatch"
- **Cause**: Actual count differs from expected
- **Solution**: Enter actual denominations, add comment

### "Cannot create superbundle"
- **Cause**: Bundles not in HANDEDOVER_TO_ASM status
- **Solution**: Accept bundles first

### "SuperBundle amount mismatch"
- **Cause**: Aggregated denominations don't match expected
- **Solution**: Review bundle amounts, recalculate

## SLA Guidelines

- Accept bundles within **24 hours** of receipt
- Create superbundles within **48 hours** of acceptance
- Follow up on unbundled orders > **60 minutes**

## KPIs to Monitor

1. **Bundles Pending Handover**: Should be < 5
2. **Unbundled Amount**: Should be < ₹50,000
3. **SLA Violations**: Should be < 10 per day
4. **Rejection Rate**: Should be < 5%

## Support

If you encounter issues:
1. Check this guide
2. Review bundle details
3. Contact SM or admin
4. Reach out to support team

## FAQs

**Q: Can I reject a bundle after accepting?**
A: No, once accepted, bundle moves to next stage. Contact SM if issue.

**Q: How many bundles per superbundle?**
A: No limit, but typically 5-20 bundles per superbundle.

**Q: What if rider doesn't respond to justification request?**
A: Escalate to rider manager after 24 hours.

**Q: Can I modify superbundle after creation?**
A: Only if status is CREATED. Once READY_FOR_HANDOVER, it's immutable.

**Q: What happens if SM rejects superbundle?**
A: SuperBundle status → REJECTED. Bundles remain in HANDEDOVER_TO_ASM. Review and correct.
