# COD Cash Lifecycle Management System — Fresh Functional Requirements Document (FRD)

*(A fully rewritten, clean, modern, coherent FRD that integrates Rider Bundles, ASM SuperBundle (ASM-level bundle-of-bundles)s, cash chain-of-custody, existing flows, operational friendliness, KPI hierarchy, and system integrity.)*

---

# 1. Executive Summary

**Project Note:** This FRD is now intended for a **full rebuild of the COD Cash Lifecycle Management System from scratch**. All components—including data models, workflows, UI/UX, backend logic, and infrastructure—must be reimplemented cleanly using the redesigned architecture defined in this document. No legacy assumptions or constraints should be carried over. The system should be built as a fresh, modern, modular, and scalable platform.

**Note:** COD Summary Dashboard is strictly read-only. No action items may appear on the dashboard. All role-specific actions must exist in separate dedicated pages (Rider Actions, ASM Actions, SM Actions, Finance Actions).
The COD Cash Lifecycle Management System ensures **complete, tamper-proof, end-to-end traceability** of COD money across all actors:

**Customer → Rider → ASM → Store Manager → Bank → Finance**

This FRD defines:

* A strict but operational-friendly bundling system
* Rider Bundles (cash packets tied to orders)
* ASM SuperBundles (bundle of bundles)
* Clear segregation of bundled/unbundled orders
* Enhanced ASM control surface
* Clean deposit and reconciliation flows
* Complete cash chain-of-custody and auditability

The system upgrades the legacy COD workflow without breaking any existing functionality.

---

# 2. Objectives

### **Primary Goals**

* Full visibility of who is holding how much cash at any moment
* Zero leakage, zero blind spots, zero cash unaccounted
* Dual-layer bundling for maximum fraud protection
* Operational friendliness for Riders, ASMs, SMs, Finance
* Real-time KPI and risk monitoring across hierarchy

### **Secondary Goals**

* Maintain compatibility with existing event-based order tracking
* Maintain simplicity for field staff while increasing system robustness
* Introduce ledger-based accountability per Rider and ASM

---

# 3. Scope

### **In Scope**

* Rider Bundles
* ASM SuperBundles
* Cash chain-of-custody logging
* Enhanced ASM dashboard & actions page
* Updated order money state machine
* New KPIs and SLA monitoring
* Updated deposit & reconciliation logic

### **Out of Scope**

* Inventory management
* Rider payroll or incentive systems
* Customer-facing payment interfaces

---

# 4. User Roles & Permissions

## 4.1 Rider

* Collects cash
* Creates Rider Bundles
* Provides denomination details
* Seals bundles (immutable)
* Responds to ASM justification requests

## 4.2 ASM (Assistant Store Manager)

* Sees rider-wise summary
* Validates rider bundles
* Challenges unbundled orders
* Creates ASM SuperBundles
* Hands over SuperBundles to SM

## 4.3 Store Manager (SM)

* Accepts SuperBundles
* Validates cash
* Creates deposits
* Uploads deposit slips

## 4.4 Finance

* Reviews deposits
* Performs reconciliation
* Flags mismatches

## 4.5 Admin

* Full access
* Manages simulator, settings, and testing

---

# 5. System Concepts & Entities

## 5.1 Rider Bundle

A group of COD-collected orders sealed together with full denomination breakdown.

### Attributes

* bundle_id (UUID)
* rider_id
* order_ids[]
* expected_amount
* denomination_breakdown
* status: CREATED, READY_FOR_HANDOVER, HANDEDOVER_TO_ASM
* timestamps

---

## 5.2 ASM SuperBundle

A bundle-of-bundles created by ASM for handover to Store Manager.

### Attributes

* superbundle_id
* asm_id
* rider_bundle_ids[]
* expected_amount
* denomination_breakdown
* status: CREATED, READY_FOR_SM_HANDOVER, HANDEDOVER_TO_SM

---

## 5.3 Ledgers

### Rider Ledger

Tracks:

* collected total
* bundled total
* unbundled total
* rider shortfall

### ASM Ledger

Tracks:

* collected bundles
* included-in-superbundle total
* pending bundles
* asm shortfall

---

# 6. Workflows

# 6.1 Order → Rider → Bundle Workflow

1. Order produced from WMS
2. Rider delivers to customer
3. On COD collection:

   * Order moves to COLLECTED_BY_RIDER
4. Rider selects collected orders → creates Rider Bundle
5. Rider enters denomination breakdown
6. System validates amount = expected
7. Rider signs and seals bundle
8. Orders move to BUNDLED

---

# 6.2 Rider → ASM Handover Workflow

1. Rider marks bundle READY_FOR_HANDOVER
2. ASM sees:

   * Bundled orders (safe)
   * Unbundled orders (risk)
   * Amounts per Rider
3. ASM inspects bundle:

   * counts cash
   * validates denominations
4. ASM accepts → bundle status = HANDEDOVER_TO_ASM

---

# 6.3 ASM → SM SuperBundle Workflow

1. ASM selects multiple Rider Bundles
2. Creates SuperBundle
3. Enters denominations
4. Signs & seals
5. Hands over to SM
6. SuperBundle status = HANDEDOVER_TO_SM

---

# 6.4 SM Deposit Workflow

SM operates on **Deposit Bundles** (SM-level bundle grouping multiple ASM SuperBundles).

### Flow

1. SM reviews incoming ASM SuperBundles.

2. Creates a **DepositBundle**:

   * Links 1..n SuperBundles
   * Enters deposit details

3. Uploads deposit slip

4. Expected vs bank amount validated

5. Finance sees Original vs Actual Expected Collection

6. Mismatch → exception, flagged to Finance + Admin

7. SM collects SuperBundles

8. Creates deposit batch

9. Uploads deposit slip

10. Expected vs bank amount validated

11. Mismatch → exception

---

# 6.5 Finance Reconciliation Workflow

Finance receives **two expected amounts** from DepositBundle:

1. **Original Expected Collection** – Based on total COD before not-collected cases.
2. **Actual Expected Collection** – Adjusted after subtracting not-collected and partial-collection cases.

### Partial Collection Handling

System must:

* Show order-level partial amount collected
* Show remaining uncollected amount
* Provide rider justification (if required)
* Show bundle → superbundle → depositbundle lineage

### Enhanced Finance UX

Finance UI must contain:

* SuperBundle and Rider Bundle drilldown
* Color-coded variance indicators
* Timeline of events
* Exception resolution tools

---

Finance receives two expected amounts:

1. **Original Expected Collection** – Total COD collectible before subtracting non-collected cases.
2. **Actual Expected Collection** – Adjusted total after subtracting all not-collected, partial-collection, and exception cases.

### Enhanced Requirements

* System must clearly display partial-collection scenarios with order-level breakdown.
* Finance UX must show:

  * Collected Amount
  * Not Collected Amount (with reasons)
  * Partially Collected Amount (with details)
  * Adjusted Expected Collection
* Full chain-of-custody context (Rider Bundle → ASM SuperBundle → SM DepositBundle) must be visible.

---

# 7. Money State Machine

```
UNCOLLECTED
→ COLLECTED_BY_RIDER
→ BUNDLED
→ READY_FOR_HANDOVER
→ HANDOVER_TO_ASM
→ INCLUDED_IN_SUPERBUNDLE
→ DEPOSITED
→ RECONCILED
```

---

# 8. ASM Action Page Requirements

## A. Rider Summary Cards

Each card shows:

* Total collected
* Bundled amount
* Unbundled amount
* Pending cash-in-hand
* Bundles ready

## B. Order Segregation

* Bundled Orders (badge: bundle_id)
* Unbundled Collected Orders (risk panel)
* Reasons for unbundled items

## C. Bundle Handling Tools

* Accept Bundle
* Reject Bundle (with reason)
* Request Rider Justification
* Create SuperBundle

---

# 9. Data Model

## 9.1 New Entity: DepositBundle (SM-Level)

A DepositBundle groups multiple ASM SuperBundles into a single bank deposit.

### Attributes

* depositbundle_id (UUID)
* sm_id
* superbundle_ids[]
* expected_original_amount
* expected_actual_amount
* bank_deposited_amount
* deposit_slip_url
* status: CREATED, SUBMITTED_TO_BANK, VERIFIED_BY_FINANCE, MISMATCH_EXCEPTION
* created_at
* submitted_at
* verified_at

### Purpose

* Consolidate ASM SuperBundles
* Create a single deposit operation per SM
* Provide clean reconciliation layer for Finance
* Support Original vs Actual Expected Collection

---

## 9.2 Updated Entity Relationships Diagram

```
Orders → RiderBundles → ASMSuperBundles → DepositBundles → Deposits → FinanceReconciliation
```

---

## 9.3 Updated Tables

(Existing content continues below)

## New Tables

* rider_bundles
* rider_bundle_orders
* asm_superbundles

## Modified Tables

* orders: add `bundle_id`, new states
* deposits: link to superbundle

---

# 10. KPIs

## 10.1 Dashboard KPIs (Read-Only)

* Total COD Orders
* Total COD Amount
* Total Collected (Rider Level)
* Total Bundled (Rider Bundles)
* Total SuperBundled (ASM Level)
* Total Deposited (SM Level)
* Original Expected Collection
* Actual Expected Collection
* Variance (Expected Actual vs Bank)

## 10.2 Rider-Level KPIs

* Unbundled amount
* Number of unbundled orders
* Rider shortfall amount
* SLA breaches for late bundling

## 10.3 ASM-Level KPIs

* Pending Rider Bundles
* Unbundled Rider Orders
* SuperBundles created today
* SuperBundles pending SM handover
* ASM shortfall amount

## 10.4 SM-Level KPIs

* Pending DepositBundles
* SuperBundles not yet deposited
* Mismatch alerts

## 10.5 Finance KPIs

* Original vs Actual Expected Collection
* Verified deposits today
* Bank mismatch occurrences
* Reconciliation exceptions

---

### Rider KPIs

* Unbundled amount
* Bundled amount
* SLA violations

### ASM KPIs

* Bundles pending
* Unbundled rider orders
* SuperBundles created

### SM KPIs

* Pending SuperBundles
* Deposit mismatches

---

# 11. SLAs & Alerts

* Rider bundling SLA: X minutes
* ASM acceptance SLA: Y minutes
* Deposit SLA: Z hours
* Unbundled alerts
* Mismatch alerts

---

# 12. Security & RLS

* Riders can only edit before sealing
* ASM can only modify bundles in their region
* SM only sees assigned SuperBundles
* Finance full read-only with reconciliation rights

---

# 13. Non-Functional Requirements

* Real-time updates under 1s
* Immutability after sealing
* Complete audit trail for all bundle operations
* Zero data inconsistency between bundle and orders

---

# 14. Appendix

* API contracts
* SQL structures
* UI wireframe references
* KPI formulas

---

**End of Fresh FRD**

---

# 15. Workflow Diagrams (High-Level)

## 15.1 Rider Bundle Flow

```
COLLECTED_BY_RIDER → BUNDLED → READY_FOR_HANDOVER → HANDEDOVER_TO_ASM
```

## 15.2 ASM SuperBundle Flow

```
HANDEDOVER_TO_ASM (Rider Bundles)
→ SELECT_BUNDLES
→ CREATE_SUPERBUNDLE
→ READY_FOR_SM_HANDOVER
→ HANDEDOVER_TO_SM
```

## 15.3 SM DepositBundle Flow

```
HANDEDOVER_TO_SM (SuperBundles)
→ SELECT_SUPERBUNDLES
→ CREATE_DEPOSITBUNDLE
→ SUBMITTED_TO_BANK
→ VERIFIED_BY_FINANCE
```

## 15.4 Reconciliation Flow

```
EXPECTED_ORIGINAL
→ EXPECTED_ACTUAL
→ BANK_DEPOSITED
→ MATCH? YES → RECONCILED | NO → MISMATCH_EXCEPTION
```

---

# 16. Finance UX Requirements

### Key Panels

* DepositBundle Summary
* Expected Original vs Expected Actual vs Bank Amount
* Partial Collections Breakdown
* Not Collected Orders Summary
* Variance Table

### Interaction Requirements

* Expand SuperBundle → Rider Bundle → Order Tree
* View denomination mismatch indicators
* Approve, escalate, or reject mismatched deposits

# 15. Workflow Diagrams (Extended & Detailed)

This document expands all workflows beyond section **15.4 Reconciliation Flow** and introduces additional layers of operational, audit, exception, and escalation flows required in a complete COD cash lifecycle rebuild.

---

# 15. Workflow Diagrams (High-Level)

## 15.1 Rider Bundle Flow

```
COLLECTED_BY_RIDER
→ SELECT_ORDERS
→ CREATE_RIDER_BUNDLE
→ VALIDATE_DENOMINATIONS
→ SEAL_BUNDLE (IMMUTABLE)
→ READY_FOR_HANDOVER
→ HANDEDOVER_TO_ASM
```

---

## 15.2 ASM SuperBundle Flow

```
HANDEDOVER_TO_ASM (Rider Bundles)
→ VERIFY_CASH
→ ACCEPT_OR_REJECT_BUNDLE
→ SELECT_MULTIPLE_RIDER_BUNDLES
→ CREATE_SUPERBUNDLE
→ VALIDATE_SUPERBUNDLE_DENOMINATIONS
→ SEAL_SUPERBUNDLE (IMMUTABLE)
→ READY_FOR_SM_HANDOVER
→ HANDEDOVER_TO_SM
```

---

## 15.3 SM DepositBundle Flow

```
RECEIVE_SUPERBUNDLES
→ VALIDATE_CASH
→ SELECT_SUPERBUNDLES
→ CREATE_DEPOSITBUNDLE
→ INPUT_DEPOSIT_DETAILS
→ UPLOAD_DEPOSIT_SLIP
→ SUBMITTED_TO_BANK
→ AWAIT_BANK_CONFIRMATION
```

---

## 15.4 Reconciliation Flow

```
EXPECTED_ORIGINAL
→ EXPECTED_ACTUAL
→ BANK_DEPOSITED
→ MATCH?
     YES → RECONCILED
     NO  → MISMATCH_EXCEPTION
```

---

# 16. Extended Workflow Diagrams (Beyond 15.4)

Below are the workflows that logically occur after reconciliation or in parallel to the main flows. These are essential for a complete system.

---

# 16.1 Partial Collection Handling Flow

```
ORDER_DELIVERED
→ PARTIAL_COLLECTION_RECORDED_BY_RIDER
→ AUTO_ADJUST_EXPECTED_ACTUAL
→ FINANCE_FLAG_PARTIAL
→ INCLUDE_IN_RECONCILIATION
→ APPROVE_REASON / ESCALATE
```

### Notes

* Partial collection amount must reflect in Rider Bundle.
* ASM & Finance see partial amount breakdown.
* DepositBundle EXPECTED_ACTUAL subtracts remaining amount.

---

# 16.2 Unbundled Orders Escalation Flow

```
ORDER_COLLECTED
→ NOT_BUNDLED_WITHIN_SLA
→ ALERT_TO_RIDER
→ ALERT_TO_ASM
→ ASM_REQUEST_JUSTIFICATION
→ RIDER_RESPONDS
→ ASM_ACCEPTS / ESCALATES
→ (If unresolved) → FRAUD_SUSPECTED_CASE
```

---

# 16.3 Bundle Rejection & Correction Flow

```
ASM_VERIFIES_BUNDLE
→ MISMATCH_FOUND
→ REJECT_BUNDLE
→ NOTIFY_RIDER
→ RIDER_CREATES_CORRECTED_BUNDLE
→ RESUBMIT_FOR_VERIFICATION
→ ACCEPTED → MOVE_TO_SUPERBUNDLE
```

---

# 16.4 SuperBundle Error Handling Flow

```
SUPERBUNDLE_CREATED
→ DENOMINATION_ERROR
→ AUTO_REJECT_SUPERBUNDLE
→ RETURN_BUNDLES_TO_ASM_QUEUE
→ ASM_REVISES_AND_RESEALS
```

---

# 16.5 DepositBundle Mismatch Exception Flow

```
DEPOSITBUNDLE_SUBMITTED
→ BANK_DEPOSITED_AMOUNT ≠ EXPECTED_ACTUAL
→ AUTO_CREATE_EXCEPTION_TICKET
→ FINANCE_REVIEWS
→ IDENTIFY_CAUSE:
     - Rider error?
     - ASM error?
     - SM deposit mismatch?
     - Bank slip mismatch?

→ RESOLUTION_PATH:
     - UPDATE_RECORDS (if clerical)
     - MARK_SHORT / EXCESS
     - ASSIGN_ACCOUNTABILITY
     - CLOSE_EXCEPTION
```

---

# 16.6 End-of-Day Settlement Flow

```
EOD_RUN
→ CHECK_ALL_RIDER_BUNDLES_SUBMITTED
→ CHECK_ALL_SUPERBUNDLES_CREATED
→ CHECK_ALL_DEPOSITBUNDLES_SUBMITTED
→ IDENTIFY_ANY_PENDING CASH-IN-HAND
→ NOTIFY_RELEVANT_ROLE
→ GENERATE_EOD_REPORT
```

---

# 16.7 Fraud Suspicion Workflow

```
DETECTED_ANOMALY
→ PATTERN_ANALYZER (unbundled totals, repeated mismatches, recurring partials)
→ FLAG_USER (Rider / ASM / SM)
→ AUTO_ESCALATION_TO_ADMIN
→ MANUAL_REVIEW_REQUIRED
→ DECISION:
     CLEAN → REMOVE_FLAG
     SUSPICIOUS → MONITOR_NEXT_7_DAYS
     CONFIRMED → MARK_AS_FRAUD + DEPLOY_ACTION
```

---

# 16.8 Audit Trail Generation Flow

```
EVENT_OCCURRED
→ LOG_ENTRY_CREATED
→ LINK_TO_ORDER / BUNDLE / SUPERBUNDLE / DEPOSITBUNDLE
→ STORE_IN_AUDIT_TABLE
→ READ-ONLY ACCESS FOR FINANCE & ADMIN
```

Audit includes:

* timestamps
* user_id
* before & after values
* device info (optional)
* GPS (for riders)

---

# 16.9 Exception Resolution Flow

```
EXCEPTION_RAISED
→ ASSIGN_TO_ROLE (Rider / ASM / SM / Finance)
→ PROVIDE_JUSTIFICATION + EVIDENCE
→ REVIEW_BY_SUPERIOR
→ DECISION:
     APPROVED
     REJECTED
     ESCALATED
→ UPDATE_RECONCILIATION_STATUS
```

---

# 16.10 Notification & SLA Workflow

```
EVENT_TRIGGERED
→ MATCH_SLA_RULE
→ SEND_NOTIFICATION_TO_ROLE
→ TRACK_ACKNOWLEDGMENT
→ IF NOT RESOLVED WITHIN SLA:
     ESCALATE_TO_NEXT_ROLE
```

Examples:

* Rider SLA for bundling
* ASM SLA for accepting bundles
* SM SLA for deposit
* Finance SLA for reconciliation

---

# 16.11 Cash Chain-of-Custody Flow (Master Flow)

```
CUSTOMER
→ RIDER (cash-in-hand)
→ RIDER_BUNDLE (sealed)
→ ASM (cash custody)
→ SUPERBUNDLE (sealed)
→ SM (cash custody)
→ DEPOSITBUNDLE (bank)
→ BANK (official custody)
→ FINANCE (reconciliation)
```

Each hop generates:

* digital signature
* timestamp
* audit log
* custody validation

---

# 16.12 System-Wide Error Recovery Flow

```
SYSTEM_FAILURE_OR_INTERRUPT
→ RETRY_OPERATION
→ IF STILL FAILS:
       SAVE_TO_RECOVERY_LOG
       NOTIFY_ADMIN
→ ADMIN_MANUAL_RETRY
→ RECONSTRUCT_STATE FROM AUDIT LOGS
```

This ensures no cash event is ever lost.

---

---

# 17. SM UX Requirements

* View incoming ASM SuperBundles
* Accept and validate denominations
* Create DepositBundles with 1..n SuperBundles
* Upload deposit slips

---

# 18. ASM UX Requirements

* Full rider summary view
* Bundled vs unbundled split
* Justification requests
* SuperBundle creation drawer
* Validation modals

---

# 19. Rider UX Requirements

* Easy order selection for bundling
* Denomination input wizard
* Photo proof upload
* SLA timer for unbundled items

---

# 20. Backend & API Requirements

## 20.1 Core API Endpoints

All endpoints must follow role-based access, JWT authentication, and RLS compliance.

### Rider Endpoints

* **POST /rider/bundles** – Create Rider Bundle
* **GET /rider/bundles?rider_id=** – Fetch Rider Bundles
* **POST /rider/bundles/:id/seal** – Seal a bundle (immutable)
* **POST /rider/justification** – Submit reasons for unbundled/partial orders

### ASM Endpoints

* **GET /asm/riders/summary** – Rider-level collection summary
* **POST /asm/bundles/:id/accept** – Validate & accept Rider Bundle
* **POST /asm/superbundles** – Create SuperbBundle
* **GET /asm/superbundles** – List ASM SuperBundles
* **POST /asm/justification/request** – Trigger justification request to Rider

### SM Endpoints

* **GET /sm/superbundles/pending** – SuperBundles awaiting deposit
* **POST /sm/depositbundle** – Create DepositBundle
* **POST /sm/depositbundle/:id/upload-slip** – Upload deposit slip

### Finance Endpoints

* **GET /finance/deposits** – All deposits + variances
* **POST /finance/deposit/:id/reconcile** – Approve or mark mismatch

---

# 21. Database Triggers & Business Logic Requirements

### 21.1 Order State Enforcement

State must move only via event triggers:

```
COLLECTED_BY_RIDER → BUNDLED → READY_FOR_HANDOVER → HANDEDOVER_TO_ASM
```

### 21.2 Bundle Immutability

Once Rider or ASM seals a bundle:

* No modifications
* No deletion
* No reassignment of orders

### 21.3 SuperBundle Linking Rules

* A RiderBundle can belong to max 1 SuperBundle
* A SuperBundle can belong to max 1 DepositBundle

### 21.4 DepositBundle Validation

On creation:

* expected_original_amount = sum(rider_bundle.expected_amount)
* expected_actual_amount = expected_original_amount - not_collected_total

### 21.5 Reconciliation Logic

```
variance = bank_deposited_amount - expected_actual_amount
if variance != 0 → status = MISMATCH_EXCEPTION
else → VERIFIED_BY_FINANCE
```

---

# 22. Supabase RLS & Permissions

### Rider

* Can create & seal own bundles
* Can only access own orders
* Cannot modify sealed bundles

### ASM (Assistant Store Manager)

* Can view all riders they manage
* Can accept bundles
* Can create SuperBundles
* Can request justifications

### SM (Store Manager)

* Can view all SuperBundles assigned
* Can create DepositBundles
* Can upload slips

### Finance

* Read-only on all bundles & deposit bundles
* Modify reconciliation state only

### Admin

* Full access

---

# 23. UI/UX Component Specifications

## 23.1 Rider Bundle Creation Drawer

**Fields:**

* selected orders
* denomination input grid
* total computed amount
* photo upload
* digital signature checkbox

**Actions:**

* Save Draft
* Seal Bundle

---

## 23.2 ASM Action Center

### Components:

* Rider Summary Cards
* Bundled Orders Table
* Unbundled Orders Risk Table
* Justification Modal
* Create SuperBundle Drawer
* Handover Validation Modal

**Color Codes:**

* Green: Safe (Bundled)
* Yellow: Pending (Awaiting Bundling)
* Red: Risk (Unbundled / SLA Breach)

---

## 23.3 SM DepositBundle Creator

**Features:**

* Select multiple SuperBundles
* Auto-sum expected amounts
* Input bank amount
* Upload slip
* Submit for finance verification

---

## 23.4 Finance Reconciliation Console

### Panels:

* DepositBundle Summary Card
* Original vs Actual Expected
* Partial Collections Breakdown
* Deposit Slip Preview
* Variance Table
* Reconciliation Actions (Approve / Flag Exception)

---

# 24. SLA Rules

### Rider SLA

* Must bundle collected cash within **X minutes**
* System alerts ASM for violations

### ASM SLA

* Must accept or reject bundles within **Y minutes**
* Must SuperBundle before shift end

### SM SLA

* Must deposit DepositBundle within **Z hours**

---

# 25. Notifications & Alerts

### Rider Alerts

* Unbundled orders pending
* SLA breach approaching

### ASM Alerts

* Rider has unbundled orders
* Rider bundle mismatch
* Bundles pending handover

### SM Alerts

* SuperBundles pending deposit
* Deposit slip missing

### Finance Alerts

* Variance mismatch
* Late deposit alerts

---

# 26. Error Handling

### Rider Bundle Errors

* Denomination mismatch
* Missing required photo
* Negative totals

### ASM Errors

* Bundle mismatch
* Rider unbundled total > 0
* Cannot create SuperBundle without all bundle validations

### SM Errors

* Deposit slip invalid
* Amount mismatch

### Finance Errors

* Reconciliation incomplete due to missing lineage

---

# 27. Performance Requirements

* Bundle creation < 200ms
* ASM actions page load < 300ms
* DepositBundle view < 300ms
* Reconciliation load < 400ms

---

# 28. Scalability

* Up to 500 RiderBundles/day per city
* Up to 200 SuperBundles/day per ASM
* Up to 100 DepositBundles/day per SM

---

# 29. Future Enhancements

* Auto-detection of suspicious patterns
* Automatic rider penalties
* Machine-learning anomaly detection
* Cash pickup routing optimization

---

# End of Updates