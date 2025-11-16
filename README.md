# COD Management Dashboard

A complete, production-grade Cash-on-Delivery (COD) Management Dashboard built with Supabase and React. Tracks and visualizes the entire cash flow from order creation to final reconciliation.

## Features

- 📊 **Hierarchical MECE KPI Dashboard** - Multi-level KPIs with filtering
- 🔄 **Realtime Updates** - Live order and KPI updates via WebSocket
- 📅 **Order Timeline** - Visual timeline of order lifecycle events
- 💼 **Store Manager Workflow** - Collect cash from ASMs, deposit slip uploads, CSV reconciliation, order state automation
- 💰 **ASM Flow** - Hard cash collection and order management
- 🔐 **Role-Based Access** - Admin, Finance, Store Manager (SM), ASM, Rider, Viewer
- 🚀 **Performance Optimized** - Sub-250ms dashboard load, <100ms KPI refresh

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **State Management**: Zustand + TanStack Query
- **Routing**: React Router
- **Build Tool**: Vite

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- Docker Desktop (for local Supabase)

### Local Development

**Option 1: Use Existing Supabase Project (Recommended)**

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd cod-dashboard
   cd frontend && npm install && cd ..
   ```

2. **Link to Your Supabase Project**
   ```bash
   supabase link --project-ref your-project-ref
   # Find project-ref in your Supabase project URL or Settings
   ```

3. **Run Migrations**
   ```bash
   supabase db push
   ```

4. **Deploy Edge Functions**
   ```bash
   supabase functions deploy webhook-wms-orders
   supabase functions deploy webhook-rider-events
   supabase functions deploy asm-deposit
   ```

5. **Configure Environment**
   ```bash
   # Frontend
   cd frontend
   cp .env.example .env.local
   # Edit .env.local with your Supabase project URL and anon key
   ```

6. **Start Development**
   ```bash
   # Frontend (from frontend/)
   npm run dev
   ```

**Option 2: Run Supabase Locally**

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd cod-dashboard
   cd frontend && npm install && cd ..
   ```

2. **Start Local Supabase**
   ```bash
   supabase start
   supabase db reset  # Run migrations
   ```

3. **Configure Environment**
   ```bash
   # Frontend
   cd frontend
   cp .env.example .env.local
   # Edit .env.local with values from `supabase start`
   ```

4. **Start Development**
   ```bash
   # Frontend (from frontend/)
   npm run dev
   
   # Edge Functions (optional, auto-reloads)
   supabase functions serve
   ```

5. **Access Application**
   - Frontend: http://localhost:5173
   - Supabase Studio: http://localhost:54323 (local) or https://app.supabase.com (remote)

### Create Admin User

**Option 1: Use Seed Script (Recommended)**

```bash
export SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=<service_role_key_from_supabase_start>
ts-node scripts/seed.ts
```

**Option 2: Use Supabase Studio**

1. Open http://localhost:54323
2. Go to Authentication → Users → Add User
3. Create user with email/password
4. Run SQL to set role:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

## Project Structure

```
cod-dashboard/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route-level pages
│   │   ├── services/      # API service layer
│   │   ├── stores/         # Zustand state stores
│   │   ├── hooks/          # Custom React hooks
│   │   └── utils/          # Utility functions
│   └── package.json
├── supabase/
│   ├── functions/         # Edge Functions (Deno)
│   │   ├── webhook-wms-orders/
│   │   ├── webhook-rider-events/
│   │   ├── asm-deposit/
│   │   └── simulator/
│   └── migrations/        # Database migrations
│       ├── 001_initial_schema.sql
│       └── 002_functions_and_triggers.sql
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── RUN_LOCALLY.md
│   └── CLEANUP.md
├── backend/               # Next.js app router (API + OTP auth)
│   ├── app/api            # Route handlers (REST)
│   └── src/lib            # Domain libs (errors, idempotency, state)
├── migrations/
│   ├── sql/               # SQL-first migrations (001-008, KPIs)
│   └── scripts/           # apply/dry-run/rollback/seed scripts
├── infra/                 # Infra placeholders
└── README.md
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System design and architecture
- [API Documentation](./docs/API.md) - API endpoints and usage
- [Run Locally](./docs/RUN_LOCALLY.md) - Local development setup
- [Cleanup](./docs/CLEANUP.md) - Data cleanup procedures

## Key Features

### 1. Hierarchical KPI Dashboard

MECE (Mutually Exclusive, Collectively Exhaustive) structure:
- **Level 1**: All Orders
- **Level 2**: COD / Prepaid
- **Level 3**: COD_HARD / COD_QR / Cancelled / RTO
- **Level 4**: Lifecycle states (Pending, Collected, Deposited, Reconciled)

### 2. Simulator

Admin-only tool for generating test data:
- Bulk order creation (N orders at once)
- Bulk processing (collect, handover, deposit, reconcile)
- Test data cleanup
- Tagged with `is_test=true` and `test_tag`

### 3. Order Timeline

Visual timeline showing:
- WMS creation
- Dispatch events
- Rider collection events
- ASM handover events
- Deposit events
- Reconciliation events

### 4. ASM Flow

ASM can:
- Mark hard cash collected
- Create deposits linking multiple orders
- Upload deposit slips
- Track deposit status

## Performance Targets

- ✅ Dashboard load: ≤ 250ms
- ✅ KPI refresh: ≤ 100ms (cached)
- ✅ Realtime update latency: < 1s
- ✅ Simulator bulk create: ≥ 1000 orders/run

## Testing

```bash
# Unit tests
cd frontend && npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Deployment

### Frontend

```bash
cd frontend
npm run build
# Deploy dist/ to Vercel, Netlify, etc.
```

### Backend

```bash
# Deploy migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy webhook-wms-orders
supabase functions deploy webhook-rider-events
supabase functions deploy asm-deposit
supabase functions deploy simulator
```

## Environment Variables

### Frontend

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Edge Functions

Set in Supabase dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## License

MIT

## Contributing

1. Create feature branch
2. Make changes
3. Write tests
4. Update documentation
5. Submit PR

## Support

For issues and questions, please open an issue on GitHub.
