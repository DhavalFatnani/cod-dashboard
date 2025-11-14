# Running Locally

## Prerequisites

- Node.js 18+ and npm
- Supabase CLI (`npm install -g supabase`) - Optional if using remote Supabase
- Docker Desktop (for local Supabase) - Only needed if running locally

## Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd cod-dashboard
```

### 2. Install Dependencies

```bash
# Root dependencies (if any)
npm install

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Supabase Setup

**Choose one of the following options:**

#### Option A: Use Existing Remote Supabase Project (Recommended for Production)

If you already have a Supabase project:

1. **Get your project credentials:**
   - Go to https://app.supabase.com
   - Select your project
   - Go to Settings → API
   - Copy:
     - Project URL (e.g., `https://xxxxx.supabase.co`)
     - `anon` public key
     - `service_role` key (keep this secret!)

2. **Link your project (optional, for migrations):**
   ```bash
   supabase link --project-ref your-project-ref
   ```
   Find your project ref in the project URL or Settings → General

3. **Run migrations on remote database:**
   ```bash
   supabase db push
   ```
   This applies all migrations from `supabase/migrations/` to your remote database.

4. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy webhook-wms-orders
   supabase functions deploy webhook-rider-events
   supabase functions deploy asm-deposit
   supabase functions deploy simulator
   ```

5. **Set environment variables:**
   - Frontend: Create `frontend/.env.local` with:
     ```env
     VITE_SUPABASE_URL=https://xxxxx.supabase.co
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```
   - Edge Functions: Set in Supabase Dashboard → Settings → Edge Functions → Secrets:
     - `SUPABASE_URL` = your project URL
     - `SUPABASE_SERVICE_ROLE_KEY` = your service_role key

#### Option B: Run Supabase Locally (For Development)

```bash
supabase start
```

This will:
- Start PostgreSQL database
- Start Edge Functions runtime
- Start Realtime server
- Print connection details

Save the output, you'll need:
- `API URL`
- `anon key`
- `service_role key`

**Run Migrations:**

```bash
supabase db reset
```

This runs all migrations in `supabase/migrations/`.

### 4. Environment Variables

#### Frontend

Create `frontend/.env.local`:

**For Local Supabase:**
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon_key_from_supabase_start>
```

**For Remote Supabase:**
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
```

#### Edge Functions

**For Local Supabase:**
Edge Functions use environment variables from Supabase CLI automatically when running locally.

**For Remote Supabase:**
Set in Supabase Dashboard → Settings → Edge Functions → Secrets:
- `SUPABASE_URL` = your project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your service_role key

### 5. Create Test User

**Option 1: Use the Seed Script (Recommended)**

The seed script creates all test users automatically:

```bash
# Get service role key from `supabase start` output
export SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=<service_role_key_from_supabase_start>

# Run seed script
ts-node scripts/seed.ts
```

This creates:
- admin@example.com / password123 (admin role)
- finance@example.com / password123 (finance role)
- asm@example.com / password123 (asm role)
- sm@example.com / password123 (sm role)
- rider@example.com / password123 (rider role)

**Option 2: Use Supabase Studio UI**

1. Open http://localhost:54323
2. Go to Authentication → Users
3. Click "Add User" → "Create new user"
4. Enter email and password
5. Go to SQL Editor and run:

```sql
-- Update user role (replace email with your user's email)
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

**Option 3: Use SQL Directly**

```sql
-- First, create user via Supabase Studio UI (Authentication → Users)
-- Then update role:
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

### 6. Start Development Servers

#### Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

#### Edge Functions (Optional - auto-reloads)

```bash
supabase functions serve
```

## Development Workflow

### Making Changes

1. **Database Changes**
   - Create migration: `supabase migration new migration_name`
   - Edit migration file in `supabase/migrations/`
   - Apply: `supabase db reset` (or `supabase migration up`)

2. **Edge Function Changes**
   - Edit files in `supabase/functions/<function-name>/`
   - Functions auto-reload when served
   - Deploy: `supabase functions deploy <function-name>`

3. **Frontend Changes**
   - Edit files in `frontend/src/`
   - Vite hot-reloads automatically
   - Build: `npm run build`

### Testing

```bash
# Frontend unit tests
cd frontend
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Database Studio

Access Supabase Studio:
```
http://localhost:54323
```

Useful for:
- Viewing tables
- Running SQL queries
- Managing RLS policies
- Viewing logs

## Common Issues

### Port Already in Use

If port 54321 is in use:

```bash
# Stop Supabase
supabase stop

# Start with different ports (if needed)
# Edit supabase/config.toml
```

### Migration Errors

```bash
# Reset database
supabase db reset

# Or rollback specific migration
supabase migration repair --status reverted <migration_name>
```

### Edge Function Errors

Check logs:
```bash
supabase functions logs <function-name>
```

### Frontend Build Errors

```bash
# Clear cache
rm -rf frontend/node_modules frontend/.vite
npm install

# Check TypeScript errors
npm run typecheck
```

## Seed Data

### Using Simulator

1. Login as admin
2. Navigate to Simulator page
3. Enter order count (e.g., 100)
4. Click "Start Simulator"
5. Use "Bulk Process" to simulate lifecycle

### Manual Seed

```sql
-- Insert test orders
INSERT INTO orders (
  order_number, store_id, payment_type, cod_type,
  order_amount, cod_amount, money_state
) VALUES (
  'ORD-TEST-001', 'STORE-001', 'COD', 'COD_HARD',
  1000.00, 1000.00, 'UNCOLLECTED'
);
```

## Production Deployment

### Frontend

1. Build: `cd frontend && npm run build`
2. Deploy `dist/` to static hosting (Vercel, Netlify, etc.)
3. Set environment variables in hosting platform

### Backend

1. **Database Migrations**
   ```bash
   supabase db push
   ```

2. **Edge Functions**
   ```bash
   supabase functions deploy webhook-wms-orders
   supabase functions deploy webhook-rider-events
   supabase functions deploy asm-deposit
   supabase functions deploy simulator
   ```

3. **Environment Variables**
   - Set in Supabase dashboard → Settings → Edge Functions
   - Or use `supabase secrets set KEY=value`

## Useful Commands

```bash
# Supabase
supabase start          # Start local Supabase
supabase stop           # Stop local Supabase
supabase status         # Check status
supabase db reset       # Reset database
supabase functions serve # Serve Edge Functions locally

# Frontend
npm run dev             # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build
npm run test            # Run tests
npm run lint            # Lint code
npm run typecheck       # Type check
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Read [API.md](./API.md) for API documentation
- Read [CLEANUP.md](./CLEANUP.md) for data cleanup procedures

