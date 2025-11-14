# Functional Requirements Document (FRD)
## COD Management Dashboard

**Version:** 1.0  
**Date:** January 2025  
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Business Requirements](#business-requirements)
4. [User Roles and Permissions](#user-roles-and-permissions)
5. [Functional Requirements](#functional-requirements)
6. [System Features](#system-features)
7. [Data Model](#data-model)
8. [Workflows](#workflows)
9. [Technical Requirements](#technical-requirements)
10. [Performance Requirements](#performance-requirements)
11. [Security Requirements](#security-requirements)
12. [Integration Requirements](#integration-requirements)
13. [Non-Functional Requirements](#non-functional-requirements)
14. [Appendices](#appendices)

---

## Executive Summary

The COD (Cash-on-Delivery) Management Dashboard is a comprehensive, production-grade web application designed to track and manage the entire cash flow lifecycle from order creation to final reconciliation. The system provides real-time visibility into COD orders, enables efficient cash collection workflows, and ensures accurate financial reconciliation.

### Key Objectives

- **Real-time Tracking**: Provide live updates of order status and cash flow
- **Workflow Automation**: Streamline cash collection, handover, and deposit processes
- **Financial Accuracy**: Ensure accurate KPI calculations and reconciliation
- **Role-Based Access**: Secure access control for different user types
- **Performance**: Sub-250ms dashboard load times with <1s realtime update latency

---

## Project Overview

### Purpose

The COD Management Dashboard addresses the critical need for real-time visibility and management of cash-on-delivery orders across the entire order lifecycle. It replaces manual tracking processes with an automated, real-time system that provides accurate financial metrics and streamlines operational workflows.

### Scope

**In Scope:**
- Order lifecycle tracking (creation to reconciliation)
- Real-time KPI dashboard with hierarchical filtering
- Cash collection workflows (Rider → ASM → Store Manager)
- Deposit management and reconciliation
- Role-based access control
- Export capabilities (CSV, XLSX, PDF)
- Test data simulation (admin only)

**Out of Scope:**
- Payment gateway integration
- Inventory management
- Customer communication
- Mobile applications (web-only)

### Target Users

- **Administrators**: System management and configuration
- **Finance Team**: Financial reconciliation and reporting
- **Store Managers (SM)**: Deposit management and reconciliation
- **Area Sales Managers (ASM)**: Cash collection and handover
- **Riders**: Order collection and status updates
- **Viewers**: Read-only access for reporting

---

## Business Requirements

### BR-1: Real-Time Order Tracking
**Priority:** High  
**Description:** The system must provide real-time visibility into order status and cash flow with updates appearing within 1 second of state changes.

**Acceptance Criteria:**
- Dashboard KPIs update automatically when orders change state
- Order table reflects changes without manual refresh
- Realtime subscriptions maintain connection with automatic reconnection

### BR-2: Accurate Financial Metrics
**Priority:** High  
**Description:** The system must calculate and display accurate financial KPIs using MECE (Mutually Exclusive, Collectively Exhaustive) principles.

**Acceptance Criteria:**
- KPI card counts match filtered order table counts
- Financial amounts are calculated correctly across all categories
- Test orders are excluded from production KPIs
- Cancelled and RTO orders are properly categorized

### BR-3: Workflow Automation
**Priority:** High  
**Description:** The system must automate order state transitions based on events and user actions.

**Acceptance Criteria:**
- Order states update automatically when events are created
- Database triggers handle state transitions
- State synchronization ensures consistency between events and orders

### BR-4: Role-Based Access Control
**Priority:** High  
**Description:** The system must enforce role-based access control at both application and database levels.

**Acceptance Criteria:**
- Users can only access data appropriate to their role
- RLS policies enforce database-level security
- Frontend routes are protected based on user roles

### BR-5: Data Export Capabilities
**Priority:** Medium  
**Description:** The system must support exporting order data in multiple formats for reporting and reconciliation.

**Acceptance Criteria:**
- Export to CSV, XLSX, and PDF formats
- Export includes all relevant order fields
- Export filters respect current view filters
- ASM handover exports include collection status and reasons

---

## User Roles and Permissions

### Role Definitions

#### 1. Admin
**Description:** Full system access with administrative privileges

**Permissions:**
- View all orders and data
- Access simulator for test data generation
- Manage users and roles
- View audit logs
- Configure system settings
- Export all data

**Restrictions:** None

#### 2. Finance
**Description:** Financial oversight and reconciliation

**Permissions:**
- View all orders and financial data
- Reconcile orders
- View audit logs
- Export financial reports
- Access finance dashboard

**Restrictions:**
- Cannot access simulator
- Cannot modify order states directly

#### 3. Store Manager (SM)
**Description:** Deposit management and reconciliation

**Permissions:**
- View orders assigned to their store
- Create deposits from ASM handover orders
- Upload deposit slips
- Reconcile deposits
- View deposit history

**Restrictions:**
- Cannot create or modify orders
- Cannot access simulator

#### 4. Area Sales Manager (ASM)
**Description:** Cash collection and handover management

**Permissions:**
- View orders assigned to them
- Mark hard cash as collected
- Mark orders as collected/not collected with reasons
- Create deposits
- Upload deposit slips
- Export handover data

**Restrictions:**
- Cannot view orders assigned to other ASMs
- Cannot reconcile deposits
- Cannot access simulator

#### 5. Rider
**Description:** Order collection and status updates

**Permissions:**
- View orders assigned to them
- Mark orders as collected (hard cash, QR payment)
- Create collection events
- View order timeline

**Restrictions:**
- Cannot create deposits
- Cannot view orders assigned to other riders
- Cannot modify order states beyond collection

#### 6. Viewer
**Description:** Read-only access for reporting

**Permissions:**
- View all orders (read-only)
- View KPIs and dashboards
- Export data (read-only)

**Restrictions:**
- Cannot modify any data
- Cannot create events or deposits
- Cannot access simulator

---

## Functional Requirements

### FR-1: Authentication and Authorization

#### FR-1.1: User Authentication
- **Requirement:** Users must authenticate using email and password
- **Implementation:** Supabase Auth with JWT tokens
- **Session Management:** Automatic session refresh and secure token storage

#### FR-1.2: Role-Based Authorization
- **Requirement:** System must enforce role-based access at application and database levels
- **Implementation:** 
  - Frontend route guards based on user role
  - Database RLS policies for data access
  - Service-level permission checks

### FR-2: Dashboard and KPIs

#### FR-2.1: Hierarchical KPI Dashboard
- **Requirement:** Display KPIs in a 4-level MECE hierarchy
- **Level 1:** All Orders (Total count and amount)
- **Level 2:** Payment Type (COD / Prepaid)
- **Level 3:** COD Type (COD_HARD / COD_QR / Cancelled / RTO)
- **Level 4:** Lifecycle States (Uncollected, Collected, Handover, Deposited, Reconciled, etc.)

**KPI Metrics:**
- Order count
- Total amount
- COD count and amount
- Prepaid count and amount
- Lifecycle state counts

#### FR-2.2: Interactive KPI Cards
- **Requirement:** KPI cards must be clickable to filter orders table
- **Behavior:** Clicking a KPI card applies appropriate filters to the orders table
- **Filter Logic:** Filters must match KPI calculation logic exactly

#### FR-2.3: Real-Time KPI Updates
- **Requirement:** KPIs must update automatically when orders change
- **Latency:** Updates must appear within 1 second
- **Implementation:** WebSocket subscriptions to order changes

#### FR-2.4: KPI Filtering
- **Requirement:** Support filtering by date range, store, rider, and ASM
- **Filters:**
  - Start date / End date
  - Store ID
  - Rider ID
  - ASM ID

### FR-3: Order Management

#### FR-3.1: Order List View
- **Requirement:** Display orders in a paginated, sortable table
- **Features:**
  - Pagination (50 items per page)
  - Sorting by multiple columns
  - Search by order number, customer name, phone
  - Filter by payment type, COD type, money state, date range
  - Export filtered results

#### FR-3.2: Order Detail View
- **Requirement:** Display comprehensive order information
- **Information Displayed:**
  - Order details (number, customer, store, amounts)
  - Payment and COD type
  - Current money state
  - Assigned rider and ASM
  - Order timeline with all events
  - Collection status and reasons (for ASM handover)

#### FR-3.3: Order Timeline
- **Requirement:** Visual timeline of order lifecycle events
- **Events Displayed:**
  - Order creation (WMS)
  - Dispatch events
  - Collection events (rider)
  - Handover events (ASM)
  - Deposit events
  - Reconciliation events
  - Cancellation/RTO events

#### FR-3.4: Order State Management
- **Requirement:** Order states must update automatically based on events
- **State Machine:**
  ```
  UNCOLLECTED → COLLECTED_BY_RIDER → HANDOVER_TO_ASM → 
  DEPOSITED → RECONCILED
  
  Alternative paths:
  - CANCELLED (at any stage)
  - RTO (Return to Origin)
  - RECONCILIATION_EXCEPTION
  ```
- **Implementation:** Database triggers update order states when events are created

### FR-4: Cash Collection Workflows

#### FR-4.1: Rider Collection Flow
- **Requirement:** Riders must be able to mark orders as collected
- **Collection Types:**
  - Hard Cash Collection
  - QR Payment Collection
- **Actions:**
  - Mark order as collected
  - Create collection event
  - Update order state to COLLECTED_BY_RIDER

#### FR-4.2: ASM Handover Flow
- **Requirement:** ASMs must manage order handover and collection
- **Features:**
  - View orders in HANDOVER_TO_ASM state
  - Mark orders as collected (hard cash)
  - Mark orders as not collected with reasons
  - Specify future collection possibility and dates
  - Create deposits from collected orders
  - Export handover data (including not collected orders)

#### FR-4.3: Store Manager Deposit Flow
- **Requirement:** Store Managers must manage deposits from ASM handovers
- **Features:**
  - View pending deposit orders (HANDOVER_TO_ASM state)
  - Create deposits linking multiple orders
  - Upload deposit slips
  - Reconcile deposits
  - Track deposit status

### FR-5: Deposit Management

#### FR-5.1: Deposit Creation
- **Requirement:** ASMs and Store Managers can create deposits
- **Deposit Information:**
  - Deposit date
  - Bank account details
  - Linked orders (multiple)
  - Deposit slip upload
  - Total deposit amount (sum of linked orders)

#### FR-5.2: Deposit Slip Upload
- **Requirement:** Support uploading deposit slip images/documents
- **Storage:** Supabase Storage bucket
- **File Types:** Images (JPG, PNG) and PDFs
- **Size Limit:** 10MB per file

#### FR-5.3: Deposit Reconciliation
- **Requirement:** Finance team can reconcile deposits
- **Actions:**
  - Mark deposit as reconciled
  - Update order states to RECONCILED
  - Handle reconciliation exceptions

### FR-6: Export Functionality

#### FR-6.1: Export Formats
- **Requirement:** Support multiple export formats
- **Formats:**
  - CSV (Comma-separated values)
  - XLSX (Excel)
  - PDF (Portable Document Format)

#### FR-6.2: Export Data
- **Requirement:** Export must include all relevant order fields
- **Standard Fields:**
  - Order number, customer details, store
  - Payment type, COD type, amounts
  - Money state, rider, ASM
  - Timestamps for lifecycle stages
- **ASM Handover Specific Fields:**
  - Collection status (Collected / Not Collected)
  - Not collected reason
  - Future collection possible (Yes/No)
  - Expected collection date

#### FR-6.3: Export Filtering
- **Requirement:** Export must respect current view filters
- **Behavior:** Export only the orders visible in the current filtered view

### FR-7: Simulator (Admin Only)

#### FR-7.1: Bulk Order Creation
- **Requirement:** Admins can create test orders in bulk
- **Features:**
  - Specify number of orders to create
  - Configure order parameters (payment type, COD type, amounts)
  - Tag orders with test_tag for identification
  - Mark orders as is_test=true

#### FR-7.2: Bulk Processing
- **Requirement:** Admins can bulk process test orders
- **Operations:**
  - Bulk collect orders
  - Bulk handover to ASM
  - Bulk deposit
  - Bulk reconcile

#### FR-7.3: Test Data Cleanup
- **Requirement:** Admins can clean up test data
- **Actions:**
  - Delete orders by test_tag
  - Delete all test orders
  - Reset simulator status

---

## System Features

### Feature 1: Hierarchical MECE KPI Dashboard

**Description:** Multi-level KPI dashboard following MECE principles for accurate financial tracking.

**Components:**
- KPI Cards (clickable, color-coded)
- Order Lifecycle Flow visualization
- Real-time updates via WebSocket

**Key Metrics:**
- Total Orders (count and amount)
- COD Orders (Hard Cash, QR, Cancelled, RTO)
- Prepaid Orders
- Lifecycle State Counts

### Feature 2: Real-Time Updates

**Description:** WebSocket-based real-time updates for orders and KPIs.

**Implementation:**
- Supabase Realtime subscriptions
- Automatic query invalidation and refetch
- Optimistic UI updates

**Update Latency:** < 1 second

### Feature 3: Order Lifecycle Management

**Description:** Automated order state management based on events.

**State Transitions:**
- Automatic state updates via database triggers
- Event-driven architecture
- State synchronization functions

### Feature 4: Contextual Guidance

**Description:** In-app guidance system to help users understand workflows.

**Features:**
- Dismissible guidance messages
- Role-specific guidance
- Persistent dismissal state (local storage)

### Feature 5: Advanced Filtering

**Description:** Comprehensive filtering system for orders.

**Filter Options:**
- Payment type (COD, Prepaid)
- COD type (COD_HARD, COD_QR, CANCELLED, RTO)
- Money state (all lifecycle states)
- Date range
- Store, Rider, ASM
- Search (order number, customer, phone)

**Filter Logic:**
- Filters must match KPI calculation logic
- Support for exclusion filters (exclude_cod_type, exclude_money_state)
- Array filters for multiple COD types

### Feature 6: Export System

**Description:** Multi-format export with comprehensive data.

**Export Locations:**
- Orders page (general exports)
- ASM Handover page (handover-specific exports)

**Export Features:**
- CSV, XLSX, PDF formats
- Filtered data export
- Custom column selection (for ASM handover)
- Progress indicators

---

## Data Model

### Core Entities

#### Orders Table
**Purpose:** Main order tracking table

**Key Fields:**
- `id` (UUID, Primary Key)
- `order_number` (TEXT, Unique)
- `store_id`, `store_name`
- `customer_name`, `customer_phone`
- `payment_type` (ENUM: COD, PREPAID)
- `cod_type` (ENUM: COD_HARD, COD_QR, CANCELLED, RTO)
- `order_amount`, `cod_amount` (DECIMAL)
- `money_state` (ENUM: lifecycle states)
- `rider_id`, `rider_name`
- `asm_id`, `asm_name`
- `wms_order_id`, `wms_created_at`
- Lifecycle timestamps (dispatched_at, collected_at, etc.)
- `is_test` (BOOLEAN), `test_tag` (TEXT)
- `metadata` (JSONB)

#### Rider Events Table
**Purpose:** Track rider actions and events

**Key Fields:**
- `id` (UUID, Primary Key)
- `order_id` (UUID, Foreign Key)
- `rider_id`, `rider_name`
- `event_type` (ENUM: ORDER_CREATED, DISPATCHED, COLLECTED, CANCELLED, RTO)
- `amount` (DECIMAL)
- `notes`, `location` (JSONB)
- `created_at` (TIMESTAMPTZ)

#### ASM Events Table
**Purpose:** Track ASM actions and events

**Key Fields:**
- `id` (UUID, Primary Key)
- `order_id` (UUID, Foreign Key)
- `asm_id`, `asm_name`
- `event_type` (ENUM: HANDOVER_TO_ASM, DEPOSITED, etc.)
- `amount` (DECIMAL)
- `notes`
- `created_at` (TIMESTAMPTZ)

#### Deposits Table
**Purpose:** Track deposit records

**Key Fields:**
- `id` (UUID, Primary Key)
- `asm_id`, `asm_name`
- `deposit_date` (DATE)
- `bank_account_number`, `bank_name`, `ifsc_code`
- `deposit_slip_url` (TEXT, Storage reference)
- `total_amount` (DECIMAL)
- `status` (ENUM: PENDING, RECONCILED, EXCEPTION)
- `reconciled_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

#### Deposit Orders Table
**Purpose:** Link orders to deposits (many-to-many)

**Key Fields:**
- `deposit_id` (UUID, Foreign Key)
- `order_id` (UUID, Foreign Key)
- `amount` (DECIMAL)

#### ASM Handover Data Table
**Purpose:** Track ASM collection status and reasons

**Key Fields:**
- `order_id` (UUID, Primary Key, Foreign Key)
- `asm_id` (TEXT)
- `is_collected` (BOOLEAN)
- `asm_non_collected_reason` (TEXT)
- `future_collection_possible` (BOOLEAN)
- `expected_collection_date` (DATE)
- `updated_at` (TIMESTAMPTZ)

#### Users Table
**Purpose:** User profiles and role management

**Key Fields:**
- `id` (UUID, Primary Key, references auth.users)
- `email` (TEXT)
- `full_name` (TEXT)
- `role` (ENUM: admin, finance, asm, rider, viewer, sm)
- `rider_id` (TEXT, Unique)
- `asm_id` (TEXT, Unique)
- `store_id` (TEXT)
- `sm_id` (TEXT)
- `phone` (TEXT)
- `is_active` (BOOLEAN)

#### Audit Logs Table
**Purpose:** Audit trail for system changes

**Key Fields:**
- `id` (UUID, Primary Key)
- `user_id` (UUID)
- `action` (TEXT)
- `resource_type` (TEXT)
- `resource_id` (UUID)
- `old_values` (JSONB)
- `new_values` (JSONB)
- `created_at` (TIMESTAMPTZ)

### Enumerations

#### Payment Type
- `COD` - Cash on Delivery
- `PREPAID` - Prepaid orders

#### COD Type
- `COD_HARD` - Hard cash payment
- `COD_QR` - QR code payment
- `CANCELLED` - Cancelled order
- `RTO` - Return to Origin

#### Money State
- `NOT_APPLICABLE` - For prepaid orders
- `UNCOLLECTED` - Not yet collected by rider
- `COLLECTED_BY_RIDER` - Collected by rider
- `HANDOVER_TO_ASM` - Handed over to ASM
- `DEPOSITED` - Deposited to bank
- `RECONCILED` - Reconciled by finance
- `RECONCILIATION_EXCEPTION` - Exception during reconciliation
- `REFUNDED` - Refunded to customer
- `CANCELLED` - Cancelled order

#### User Role
- `admin` - Administrator
- `finance` - Finance team
- `asm` - Area Sales Manager
- `rider` - Delivery rider
- `viewer` - Read-only viewer
- `sm` - Store Manager

---

## Workflows

### Workflow 1: Order Lifecycle (COD)

```
1. Order Created (WMS)
   └─> State: UNCOLLECTED
   
2. Order Dispatched (Rider Event)
   └─> State: UNCOLLECTED (no change)
   
3. Order Collected (Rider Event)
   └─> State: COLLECTED_BY_RIDER
   
4. Handover to ASM (ASM Event)
   └─> State: HANDOVER_TO_ASM
   
5. Deposit Created (ASM/SM)
   └─> State: DEPOSITED
   
6. Reconciliation (Finance)
   └─> State: RECONCILED
```

### Workflow 2: ASM Collection Flow

```
1. ASM views orders in HANDOVER_TO_ASM state
   
2. For each order:
   a. Mark as Collected
      └─> Create collection event
      └─> Update ASM handover data
   
   b. Mark as Not Collected
      └─> Specify reason
      └─> Indicate future collection possibility
      └─> Set expected collection date
      └─> Update ASM handover data
   
3. Create Deposit (optional)
   └─> Select collected orders
   └─> Upload deposit slip
   └─> Create deposit record
   └─> Link orders to deposit
   └─> Update order states to DEPOSITED
```

### Workflow 3: Store Manager Deposit Flow

```
1. SM views pending deposit orders (HANDOVER_TO_ASM)
   
2. Create Deposit
   └─> Select multiple orders
   └─> Enter deposit details
   └─> Upload deposit slip
   └─> Create deposit record
   └─> Link orders to deposit
   └─> Update order states to DEPOSITED
   
3. Finance Reconciliation
   └─> Review deposit
   └─> Mark as reconciled
   └─> Update order states to RECONCILED
```

### Workflow 4: Cancellation/RTO Flow

```
1. Order Cancelled (at any stage)
   └─> Create cancellation event
   └─> Update cod_type to CANCELLED (if applicable)
   └─> Update money_state to CANCELLED
   └─> Set cancelled_at timestamp
   
2. Order RTO (Return to Origin)
   └─> Create RTO event
   └─> Update cod_type to RTO
   └─> Update money_state to CANCELLED
   └─> Set rto_at timestamp
```

---

## Technical Requirements

### Technology Stack

#### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **State Management:**
  - TanStack Query (React Query) - Server state
  - Zustand - Client state
- **UI Libraries:**
  - Lucide React - Icons
  - Recharts - Charts (if needed)
- **Export Libraries:**
  - xlsx - Excel export
  - jspdf + jspdf-autotable - PDF export

#### Backend
- **Platform:** Supabase
- **Database:** PostgreSQL
- **Serverless Functions:** Deno (Edge Functions)
- **Realtime:** Supabase Realtime (WebSocket)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage

### Database Requirements

#### Indexes
- `orders.payment_type`
- `orders.cod_type`
- `orders.money_state`
- `orders.is_test`
- `orders.rider_id`
- `orders.asm_id`
- `orders.store_id`
- Composite indexes for common filter combinations

#### Functions
- `get_kpi_metrics()` - Calculate KPIs
- `update_order_money_state()` - Trigger function for state updates
- `sync_order_states_from_events()` - Diagnostic function
- `fix_order_states_from_events()` - Repair function

#### Triggers
- `update_order_money_state_trigger` - Auto-update order states on event creation

### API Requirements

#### Edge Functions

1. **webhook-wms-orders**
   - Purpose: Create orders from WMS webhook
   - Method: POST
   - Authentication: Service role key

2. **webhook-rider-events**
   - Purpose: Handle rider event webhooks
   - Method: POST
   - Authentication: Service role key

3. **asm-deposit**
   - Purpose: Create deposits and link orders
   - Method: POST
   - Authentication: User JWT

4. **simulator**
   - Purpose: Generate test data (admin only)
   - Method: POST
   - Authentication: User JWT (admin role)

### Frontend Service Layer

#### Services
- `ordersService.ts` - Order CRUD operations
- `kpiService.ts` - KPI calculations
- `depositService.ts` - Deposit management
- `asmHandoverService.ts` - ASM handover operations
- `exportService.ts` - Export functionality
- `simulatorService.ts` - Simulator operations

---

## Performance Requirements

### Response Times

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Dashboard Load | ≤ 250ms | Time to first KPI render |
| KPI Refresh | ≤ 100ms | Cached query response time |
| Realtime Update Latency | < 1s | Event to UI update |
| Order Table Pagination | < 100ms | Page load time |
| Export Generation | < 5s | File generation time (1000 orders) |

### Throughput

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Simulator Bulk Create | ≥ 1000 orders/run | Orders created per batch |
| Order Query | ≥ 50 orders/query | Pagination size |
| Realtime Subscriptions | ≥ 100 concurrent | Active WebSocket connections |

### Optimization Strategies

1. **Database**
   - Indexed columns for common filters
   - Database functions for KPI aggregation
   - Batch operations (100 items per batch)

2. **Frontend**
   - React Query caching (30s stale time)
   - Debounced search/filters (300ms)
   - Pagination (50 items per page)
   - Lazy loading for routes
   - React.memo() for expensive components

3. **API**
   - Idempotent endpoints
   - Transactional operations
   - Optimized queries (minimal joins)

---

## Security Requirements

### Authentication

- **Method:** Email/password authentication via Supabase Auth
- **Session Management:** JWT tokens with automatic refresh
- **Password Policy:** Enforced by Supabase (minimum 6 characters)

### Authorization

- **Application Level:** Route guards based on user role
- **Database Level:** Row Level Security (RLS) policies
- **Service Level:** Permission checks in Edge Functions

### Data Protection

- **Encryption:** HTTPS for all communications
- **Storage:** Encrypted at rest (Supabase)
- **Service Role Key:** Only used in Edge Functions, never exposed to frontend
- **Input Validation:** All user inputs validated
- **SQL Injection Prevention:** Parameterized queries via Supabase client

### Audit Logging

- **Audit Trail:** All sensitive operations logged
- **Log Fields:** User ID, action, resource type, resource ID, old/new values, timestamp
- **Access:** Admin and Finance roles only

### RLS Policies

- **Orders:** Role-based access (admin/finance: all, ASM: assigned, Rider: assigned)
- **Events:** Access based on order assignment
- **Deposits:** ASM can view/create their own, admin/finance: all
- **Users:** Users can view own profile, admin: all

---

## Integration Requirements

### External Systems

#### 1. WMS (Warehouse Management System)
- **Integration Type:** Webhook (incoming)
- **Endpoint:** `/webhook-wms-orders`
- **Payload:** Order creation data
- **Authentication:** Service role key
- **Data Flow:** WMS → Edge Function → Database

#### 2. Rider App
- **Integration Type:** Webhook (incoming)
- **Endpoint:** `/webhook-rider-events`
- **Payload:** Rider event data (collection, dispatch, cancellation)
- **Authentication:** Service role key
- **Data Flow:** Rider App → Edge Function → Database

### Internal Integrations

#### 1. Supabase Services
- **Auth:** User authentication and session management
- **Database:** PostgreSQL with RLS
- **Realtime:** WebSocket subscriptions
- **Storage:** File uploads (deposit slips)
- **Edge Functions:** Serverless functions

#### 2. Frontend-Backend Communication
- **Protocol:** HTTPS/REST
- **Client:** Supabase JS client
- **Real-time:** WebSocket via Supabase Realtime

---

## Non-Functional Requirements

### Usability

- **Responsive Design:** Mobile-first approach, works on all screen sizes
- **Accessibility:** WCAG 2.1 Level AA compliance
- **Error Messages:** Clear, user-friendly error messages
- **Loading States:** Loading indicators for async operations
- **Contextual Guidance:** In-app help and guidance

### Reliability

- **Uptime:** 99.9% availability target
- **Error Handling:** Graceful error handling with user feedback
- **Data Consistency:** Transactional operations ensure data integrity
- **State Synchronization:** Automatic state sync between events and orders

### Maintainability

- **Code Quality:** TypeScript strict mode, ESLint rules
- **Documentation:** Comprehensive code comments and documentation
- **Testing:** Unit tests, integration tests, E2E tests
- **Version Control:** Git with feature branch workflow

### Scalability

- **Current Capacity:** 1000+ orders per batch operation
- **Future Considerations:**
  - Materialized views for KPIs
  - Redis caching layer
  - CDN for static assets
  - Horizontal scaling for Edge Functions

---

## Appendices

### Appendix A: KPI Calculation Logic

#### Total Orders
```sql
WHERE is_test = false
AND (date filters, store filters, etc.)
```

#### COD Orders
```sql
WHERE is_test = false
AND payment_type = 'COD'
AND (date filters, store filters, etc.)
```

#### Prepaid Orders
```sql
WHERE is_test = false
AND payment_type = 'PREPAID'
AND cod_type IS DISTINCT FROM 'RTO'
AND (cod_type IS DISTINCT FROM 'CANCELLED' OR cod_type IS NULL)
AND money_state IS DISTINCT FROM 'CANCELLED'
AND (date filters, store filters, etc.)
```

#### Cancelled Orders
```sql
WHERE is_test = false
AND (
  cod_type = 'CANCELLED'  -- Legacy format
  OR (money_state = 'CANCELLED' AND cod_type IS DISTINCT FROM 'RTO')  -- New format
)
AND (date filters, store filters, etc.)
```

#### RTO Orders
```sql
WHERE is_test = false
AND cod_type = 'RTO'
AND (date filters, store filters, etc.)
```

### Appendix B: Order State Machine

```
UNCOLLECTED
  ↓ (rider collects)
COLLECTED_BY_RIDER
  ↓ (ASM handover)
HANDOVER_TO_ASM
  ↓ (deposit created)
DEPOSITED
  ↓ (finance reconciles)
RECONCILED

Alternative paths:
- CANCELLED (at any stage)
- RTO (Return to Origin)
- RECONCILIATION_EXCEPTION
```

### Appendix C: Export Field Mappings

#### Standard Order Export
- Order Number
- Customer Name
- Customer Phone
- Store ID / Store Name
- Payment Type
- COD Type
- Order Amount
- COD Amount
- Money State
- Rider ID / Rider Name
- ASM ID / ASM Name
- Created At
- Dispatched At
- Collected At
- Handover At
- Deposited At
- Reconciled At

#### ASM Handover Export (Additional Fields)
- Collection Status (Collected / Not Collected)
- Not Collected Reason
- Future Collection Possible (Yes/No)
- Expected Collection Date

### Appendix D: Environment Variables

#### Frontend (.env)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Edge Functions (Supabase Dashboard)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Appendix E: Database Migrations

Key migrations:
- `001_initial_schema.sql` - Core schema
- `002_functions_and_triggers.sql` - Database functions and triggers
- `030_simplified_kpi_logic.sql` - KPI calculation logic
- `032_fix_order_state_sync.sql` - State synchronization fixes

### Appendix F: API Endpoints

#### REST API (via Supabase)
- `GET /rest/v1/orders` - List orders
- `GET /rest/v1/orders/:id` - Get order details
- `POST /rest/v1/rider_events` - Create rider event
- `POST /rest/v1/asm_events` - Create ASM event
- `POST /rest/v1/deposits` - Create deposit

#### Edge Functions
- `POST /functions/v1/webhook-wms-orders` - WMS webhook
- `POST /functions/v1/webhook-rider-events` - Rider webhook
- `POST /functions/v1/asm-deposit` - Create deposit
- `POST /functions/v1/simulator` - Simulator operations

---

## Document Control

**Version History:**

| Version | Date | Author | Changes |
|---------|------|---------|---------|
| 1.0 | January 2025 | System | Initial FRD creation |

**Approval:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Manager | | | |
| Technical Lead | | | |
| Business Analyst | | | |

---

**End of Document**

