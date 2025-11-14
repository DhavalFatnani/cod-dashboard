# COD Dashboard Architecture

## Overview

The COD Management Dashboard is a full-stack application built with Supabase (PostgreSQL + Edge Functions) and React (Vite + Tailwind). It provides real-time tracking of cash-on-delivery orders from creation to final reconciliation.

## System Architecture

```
┌─────────────────┐
│   React Frontend │
│  (Vite + Tailwind)│
└────────┬─────────┘
         │
         │ HTTPS/REST
         │
┌────────▼─────────┐
│  Supabase Client │
│  (Auth + Realtime)│
└────────┬─────────┘
         │
         │
┌────────▼──────────────────────────┐
│      Supabase Backend             │
│  ┌────────────────────────────┐  │
│  │  PostgreSQL Database       │  │
│  │  - Orders, Events, Deposits│  │
│  │  - RLS Policies            │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  Edge Functions (Deno)    │  │
│  │  - Webhooks               │  │
│  │  - Simulator              │  │
│  │  - ASM Deposit            │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  Realtime Subscriptions    │  │
│  │  - Order Updates           │  │
│  │  - KPI Updates             │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **TanStack Query (React Query)** - Server state management
- **Zustand** - Client state management
- **Supabase JS** - Backend client

### Backend
- **Supabase** - Backend-as-a-Service
  - **PostgreSQL** - Database
  - **Edge Functions** - Serverless functions (Deno)
  - **Realtime** - WebSocket subscriptions
  - **Auth** - Authentication & authorization
  - **RLS** - Row Level Security

## Data Model

### Core Tables

#### `orders`
Main order table tracking COD lifecycle:
- Order details (number, customer, store)
- Payment type (COD/PREPAID)
- COD type (HARD/QR/CANCELLED/RTO)
- Money state (UNCOLLECTED → COLLECTED → DEPOSITED → RECONCILED)
- Timestamps for each lifecycle stage

#### `rider_events`
Events created by riders:
- Collection events
- Dispatch events
- Cancellation/RTO events

#### `asm_events`
Events created by ASMs:
- Handover events
- Deposit events

#### `deposits`
ASM deposit records:
- Links multiple orders
- Deposit slip uploads
- Bank account details

#### `audit_logs`
Audit trail for all changes:
- User actions
- Before/after values
- Timestamps

### State Machine

```
Order Lifecycle (COD):
UNCOLLECTED → COLLECTED_BY_RIDER → HANDOVER_TO_ASM → 
PENDING_TO_DEPOSIT → DEPOSITED → RECONCILED

Alternative paths:
- CANCELLED (at any stage)
- RTO (Return to Origin)
- RECONCILIATION_EXCEPTION
```

## Key Features

### 1. Hierarchical MECE KPI Dashboard
- Level 1: All Orders
- Level 2: COD / Prepaid
- Level 3: COD_HARD / COD_QR / Cancelled / RTO
- Level 4: Lifecycle states (Pending, Collected, Deposited, etc.)

### 2. Realtime Updates
- WebSocket subscriptions to order changes
- Automatic KPI refresh (< 1s latency)
- Live order table updates

### 3. Simulator (Admin Only)
- Bulk order creation
- Bulk processing (collect, handover, deposit)
- Test data cleanup
- Tagged with `is_test=true` and `test_tag`

### 4. Order Timeline
- Visual timeline of all events
- Rider events + ASM events
- Document uploads (deposit slips)
- Exportable to CSV/PDF

### 5. ASM Flow
- Mark hard cash collected
- Create deposits
- Link multiple orders to deposits

## Security

### Authentication
- Supabase Auth (email/password)
- JWT tokens for API access
- Session management

### Authorization (RLS)
- **Admin**: Full access, simulator access
- **Finance**: View all, reconcile orders
- **ASM**: View assigned orders, create deposits
- **Rider**: View assigned orders, create events
- **Viewer**: Read-only access

### Data Protection
- RLS policies enforce access control
- Service role key only in Edge Functions
- Input validation on all endpoints
- Audit logging for sensitive operations

## Performance Optimizations

### Database
- Indexed columns (payment_type, money_state, etc.)
- Composite indexes for common filters
- Database functions for KPI aggregation
- Batch operations for bulk inserts

### Frontend
- React Query caching (30s stale time)
- Debounced search/filters (300ms)
- Pagination (50 items per page)
- Lazy loading for routes
- Realtime subscriptions for updates

### API
- Idempotent endpoints
- Transactional operations
- Batch processing (100 items/batch)
- Optimized queries (minimal joins)

## Scalability

### Current Limits
- Dashboard load: ≤ 250ms
- KPI refresh: ≤ 100ms (cached)
- Realtime latency: < 1s
- Simulator: ≥ 1000 orders/run

### Future Considerations
- Materialized views for KPIs
- Redis caching layer
- CDN for static assets
- Horizontal scaling for Edge Functions

## Deployment

### Frontend
- Build: `npm run build`
- Deploy: Static hosting (Vercel, Netlify, etc.)
- Environment: Vite env variables

### Backend
- Database: Supabase migrations
- Edge Functions: Supabase CLI deploy
- Realtime: Enabled via Supabase dashboard

## Monitoring

### Metrics to Track
- Dashboard load time
- KPI query performance
- Realtime update latency
- Error rates
- User activity

### Logging
- Edge Function logs (Supabase dashboard)
- Frontend errors (Sentry, etc.)
- Audit logs (database table)

## Development Workflow

1. **Local Setup**
   - Run Supabase locally (`supabase start`)
   - Start frontend dev server (`npm run dev`)
   - Run migrations

2. **Feature Development**
   - Create feature branch
   - Write tests
   - Update documentation
   - Submit PR

3. **Testing**
   - Unit tests (Vitest)
   - Integration tests
   - E2E tests (Playwright)

4. **Deployment**
   - CI/CD pipeline (GitHub Actions)
   - Run migrations
   - Deploy Edge Functions
   - Deploy frontend

