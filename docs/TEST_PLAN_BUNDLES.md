# Bundle System Test Plan

## Overview
This test plan covers the Rider Bundles and ASM SuperBundles functionality.

## Test Cases

### 1. Bundle Creation Validation
**Test**: Rider creates bundle with valid denominations
- **Steps**: 
  1. Rider selects multiple orders in COLLECTED_BY_RIDER state
  2. Enters denomination breakdown matching expected amount
  3. Uploads photo proofs
  4. Confirms digital signoff
  5. Creates bundle
- **Expected**: Bundle created successfully, orders updated to BUNDLED state
- **Priority**: High

### 2. Denomination Mismatch Validation
**Test**: Rider tries to create bundle with incorrect denominations
- **Steps**:
  1. Rider selects orders totaling ₹10,000
  2. Enters denominations totaling ₹9,500
  3. Attempts to create bundle
- **Expected**: Error message, bundle not created
- **Priority**: High

### 3. Bundle Immutability After Seal
**Test**: Rider cannot modify bundle after marking READY_FOR_HANDOVER
- **Steps**:
  1. Create bundle
  2. Mark as READY_FOR_HANDOVER
  3. Attempt to modify denominations
- **Expected**: Error, bundle cannot be modified
- **Priority**: High

### 4. ASM Accept Bundle
**Test**: ASM accepts bundle with validation
- **Steps**:
  1. ASM views bundle in READY_FOR_HANDOVER status
  2. Verifies actual denominations
  3. Accepts bundle
- **Expected**: Bundle status → HANDEDOVER_TO_ASM, orders → HANDOVER_TO_ASM
- **Priority**: High

### 5. ASM Reject Bundle
**Test**: ASM rejects bundle with reason
- **Steps**:
  1. ASM views bundle
  2. Enters rejection reason
  3. Rejects bundle
- **Expected**: Bundle status → REJECTED, orders remain in previous state
- **Priority**: Medium

### 6. SuperBundle Creation
**Test**: ASM creates superbundle from multiple bundles
- **Steps**:
  1. ASM selects multiple HANDEDOVER_TO_ASM bundles
  2. System auto-aggregates denominations
  3. ASM verifies and creates superbundle
- **Expected**: SuperBundle created, bundles → INCLUDED_IN_SUPERBUNDLE
- **Priority**: High

### 7. SM Deposit from SuperBundle
**Test**: SM creates deposit from superbundle(s)
- **Steps**:
  1. SM selects superbundle(s)
  2. Uploads deposit slip
  3. Verifies bank amount
  4. Creates deposit
- **Expected**: Deposit created, superbundles → INCLUDED_IN_DEPOSIT, orders → DEPOSITED
- **Priority**: High

### 8. RLS Policy Enforcement - Rider
**Test**: Rider can only view/modify own bundles
- **Steps**:
  1. Rider A creates bundle
  2. Rider B attempts to view/modify Rider A's bundle
- **Expected**: Access denied
- **Priority**: High

### 9. RLS Policy Enforcement - ASM
**Test**: ASM can only view bundles assigned to them
- **Steps**:
  1. ASM A has bundle assigned
  2. ASM B attempts to view/modify ASM A's bundle
- **Expected**: Access denied
- **Priority**: High

### 10. SLA Violation Detection
**Test**: System detects orders unbundled > 60 minutes
- **Steps**:
  1. Create order in COLLECTED_BY_RIDER without bundle
  2. Wait > 60 minutes
  3. Check SLA violations KPI
- **Expected**: Order appears in SLA violations
- **Priority**: Medium

### 11. Unbundled Orders Justification
**Test**: ASM requests justification for unbundled order
- **Steps**:
  1. ASM views unbundled orders table
  2. Clicks "Ask Justification"
  3. Sends message to rider
- **Expected**: Message sent, order updated with unbundled_reason
- **Priority**: Medium

### 12. Bundle Photo Upload Validation
**Test**: Photo upload with size/format restrictions
- **Steps**:
  1. Attempt to upload > 10MB file
  2. Attempt to upload non-image file
  3. Upload valid JPG/PNG
- **Expected**: Errors for invalid files, success for valid
- **Priority**: Medium

### 13. Concurrent Bundle Creation
**Test**: Multiple riders create bundles simultaneously
- **Steps**:
  1. Rider A and Rider B select same order
  2. Both attempt to create bundles
- **Expected**: One succeeds, one fails (order uniqueness constraint)
- **Priority**: Medium

### 14. SuperBundle Denomination Aggregation
**Test**: System correctly aggregates denominations from multiple bundles
- **Steps**:
  1. Bundle 1: ₹2000×5, ₹500×10
  2. Bundle 2: ₹2000×3, ₹500×5
  3. Create superbundle
- **Expected**: Aggregated: ₹2000×8, ₹500×15
- **Priority**: High

### 15. Deposit Amount Verification
**Test**: SM verifies bank amount against superbundle expected amount
- **Steps**:
  1. SuperBundle expected: ₹50,000
  2. SM enters bank amount: ₹49,500
  3. Creates deposit
- **Expected**: Validation status = MISMATCH, deposit created with warning
- **Priority**: High

### 16. Retrospective Bundle Creation (Feature Flag)
**Test**: Create bundles for existing COLLECTED_BY_RIDER orders
- **Steps**:
  1. Enable retrospective_bundles feature flag
  2. Run create_retrospective_bundles() function
- **Expected**: Bundles created for existing orders
- **Priority**: Low

### 17. Legacy Order Handling
**Test**: Orders already in HANDOVER_TO_ASM work without bundles
- **Steps**:
  1. Verify legacy orders marked correctly
  2. SM creates deposit from legacy orders
- **Expected**: Deposit works, orders marked as legacy
- **Priority**: Medium

### 18. Bundle Status Transitions
**Test**: Verify all valid status transitions
- **Steps**:
  1. CREATED → READY_FOR_HANDOVER
  2. READY_FOR_HANDOVER → HANDEDOVER_TO_ASM
  3. HANDEDOVER_TO_ASM → INCLUDED_IN_SUPERBUNDLE
  4. READY_FOR_HANDOVER → REJECTED
- **Expected**: All transitions work, invalid transitions fail
- **Priority**: High

### 19. KPI Metrics Accuracy
**Test**: Bundle KPIs reflect actual data
- **Steps**:
  1. Create bundles
  2. Check KPI metrics
- **Expected**: Metrics match actual bundle counts/amounts
- **Priority**: Medium

### 20. Realtime Updates
**Test**: UI updates in realtime when bundle status changes
- **Steps**:
  1. Open bundle list
  2. Change bundle status in another session
- **Expected**: UI updates automatically
- **Priority**: Medium

## Test Environment Setup
- Test database with sample orders
- Test users: Rider, ASM, SM, Admin
- Feature flags: All enabled for testing

## Test Data Requirements
- 100+ test orders in various states
- Multiple riders and ASMs
- Mix of bundled and unbundled orders

## Success Criteria
- All High priority tests pass
- 90%+ of all tests pass
- No critical security issues
- Performance acceptable (< 2s for bundle operations)
