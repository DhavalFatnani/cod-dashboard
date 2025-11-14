# Rider Bundles User Guide

## Overview
This guide explains how riders can create and manage cash bundles for COD orders.

## What are Bundles?
Bundles are structured collections of COD cash orders that:
- Group multiple orders together
- Require denomination breakdown
- Include photo proofs
- Must be sealed before handover to ASM

## Creating a Bundle

### Step 1: Select Orders
1. Navigate to **Rider Bundles** page
2. View **Pending Cash Bundling** section
3. Select orders you want to bundle (checkbox)
4. Click **Create Bundle** button

**Note**: Only orders in `COLLECTED_BY_RIDER` state without existing bundles can be selected.

### Step 2: Enter Denominations
1. System shows expected total amount
2. Enter count for each denomination (₹2000, ₹500, ₹200, etc.)
3. System validates sum matches expected amount
4. Green checkmark appears when amounts match

**Example**:
- Expected: ₹15,000
- Enter: ₹2000×5, ₹500×10
- Calculated: ₹15,000 ✓

### Step 3: Upload Photo Proofs
1. Click **browse** or drag-drop photos
2. Upload up to 5 photos (JPG/PNG, max 10MB each)
3. Preview uploaded photos
4. Remove photos if needed

**Tips**:
- Take clear photos of cash
- Include denomination labels if possible
- Ensure good lighting

### Step 4: Digital Signoff
1. Check **"I confirm..."** checkbox
2. Review bundle details
3. Click **Create Bundle**

### Step 5: Seal Bundle
1. After creation, bundle status is `CREATED`
2. Review bundle details
3. Click **Mark as Ready for Handover**
4. Bundle status changes to `READY_FOR_HANDOVER`
5. Bundle becomes immutable (cannot be modified)

## Viewing Bundles

### Bundle List
- View all your bundles on **Rider Bundles** page
- See status, amount, order count
- Click bundle to view details

### Bundle Details
- View denomination breakdown
- See included orders
- View photo proofs
- Check timestamps (created, sealed, handed over)

## Bundle Statuses

1. **CREATED**: Just created, can be modified
2. **READY_FOR_HANDOVER**: Sealed, ready for ASM
3. **HANDEDOVER_TO_ASM**: Accepted by ASM
4. **INCLUDED_IN_SUPERBUNDLE**: Part of ASM's superbundle
5. **REJECTED**: Rejected by ASM (with reason)

## Common Issues

### "Denomination breakdown does not match"
- **Cause**: Sum of denominations ≠ expected amount
- **Solution**: Recalculate and adjust denominations

### "Order not available for bundling"
- **Cause**: Order already in bundle or wrong state
- **Solution**: Select different orders

### "Photo upload failed"
- **Cause**: File too large or wrong format
- **Solution**: Use JPG/PNG, keep under 10MB

### "Cannot modify bundle"
- **Cause**: Bundle already sealed (READY_FOR_HANDOVER)
- **Solution**: Create new bundle if changes needed

## Best Practices

1. **Bundle regularly**: Don't let unbundled cash accumulate
2. **Verify amounts**: Double-check denomination breakdown
3. **Take clear photos**: Good photos help with validation
4. **Seal promptly**: Mark ready once verified
5. **Review before sealing**: Bundle becomes immutable after sealing

## SLA Guidelines

- Orders should be bundled within **60 minutes** of collection
- Unbundled orders > 60 minutes trigger alerts
- Aim for < 30 minutes bundling time

## Support

If you encounter issues:
1. Check this guide
2. Contact your ASM
3. Reach out to support team

## FAQs

**Q: Can I unbundle a sealed bundle?**
A: No, sealed bundles are immutable. Contact ASM if correction needed.

**Q: What if I make a mistake?**
A: If bundle is still CREATED, you can modify it. If sealed, contact ASM.

**Q: How many orders per bundle?**
A: No limit, but typically 10-50 orders per bundle.

**Q: Can I bundle orders from different days?**
A: Yes, as long as they're in COLLECTED_BY_RIDER state.

**Q: What happens if ASM rejects my bundle?**
A: You'll see rejection reason. Orders return to previous state. Create new bundle.
