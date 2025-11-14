-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
CREATE TYPE payment_type AS ENUM ('COD', 'PREPAID');
CREATE TYPE cod_type AS ENUM ('COD_HARD', 'COD_QR', 'CANCELLED', 'RTO');
CREATE TYPE money_state AS ENUM (
  'NOT_APPLICABLE',
  'UNCOLLECTED',
  'COLLECTED_BY_RIDER',
  'HANDOVER_TO_ASM',
  'PENDING_TO_DEPOSIT',
  'DEPOSITED',
  'RECONCILED',
  'RECONCILIATION_EXCEPTION',
  'REFUNDED',
  'CANCELLED'
);
CREATE TYPE user_role AS ENUM ('admin', 'finance', 'asm', 'rider', 'viewer');
CREATE TYPE event_type AS ENUM (
  'ORDER_CREATED',
  'DISPATCHED',
  'COLLECTED',
  'HANDOVER_TO_ASM',
  'DEPOSITED',
  'RECONCILED',
  'CANCELLED',
  'RTO'
);

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  rider_id TEXT UNIQUE,
  asm_id TEXT UNIQUE,
  store_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flags table
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  flag_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  store_id TEXT NOT NULL,
  store_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  payment_type payment_type NOT NULL,
  cod_type cod_type,
  order_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  cod_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  money_state money_state NOT NULL DEFAULT 'UNCOLLECTED',
  rider_id TEXT,
  rider_name TEXT,
  asm_id TEXT,
  asm_name TEXT,
  wms_order_id TEXT,
  wms_created_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  handover_to_asm_at TIMESTAMPTZ,
  deposited_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  rto_at TIMESTAMPTZ,
  is_test BOOLEAN DEFAULT false,
  test_tag TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rider events table
CREATE TABLE public.rider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id TEXT NOT NULL,
  rider_name TEXT,
  event_type event_type NOT NULL,
  amount DECIMAL(12, 2),
  notes TEXT,
  location JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ASM events table
CREATE TABLE public.asm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  asm_id TEXT NOT NULL,
  asm_name TEXT,
  event_type event_type NOT NULL,
  amount DECIMAL(12, 2),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deposits table
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_number TEXT UNIQUE NOT NULL,
  asm_id TEXT NOT NULL,
  asm_name TEXT,
  total_amount DECIMAL(12, 2) NOT NULL,
  deposit_slip_url TEXT,
  deposit_date DATE NOT NULL,
  bank_account TEXT,
  status TEXT DEFAULT 'PENDING',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deposit orders junction table
CREATE TABLE public.deposit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID NOT NULL REFERENCES public.deposits(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deposit_id, order_id)
);

-- Bank transactions table
CREATE TABLE public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT UNIQUE NOT NULL,
  deposit_id UUID REFERENCES public.deposits(id),
  amount DECIMAL(12, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  bank_account TEXT,
  reference_number TEXT,
  status TEXT DEFAULT 'PENDING',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disputes table
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL,
  amount DECIMAL(12, 2),
  description TEXT,
  status TEXT DEFAULT 'OPEN',
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_orders_store_id ON public.orders(store_id);
CREATE INDEX idx_orders_rider_id ON public.orders(rider_id);
CREATE INDEX idx_orders_asm_id ON public.orders(asm_id);
CREATE INDEX idx_orders_payment_type ON public.orders(payment_type);
CREATE INDEX idx_orders_cod_type ON public.orders(cod_type);
CREATE INDEX idx_orders_money_state ON public.orders(money_state);
CREATE INDEX idx_orders_is_test ON public.orders(is_test);
CREATE INDEX idx_orders_test_tag ON public.orders(test_tag);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON public.orders(order_number);
CREATE INDEX idx_orders_composite_state ON public.orders(payment_type, cod_type, money_state);

CREATE INDEX idx_rider_events_order_id ON public.rider_events(order_id);
CREATE INDEX idx_rider_events_rider_id ON public.rider_events(rider_id);
CREATE INDEX idx_rider_events_created_at ON public.rider_events(created_at DESC);

CREATE INDEX idx_asm_events_order_id ON public.asm_events(order_id);
CREATE INDEX idx_asm_events_asm_id ON public.asm_events(asm_id);
CREATE INDEX idx_asm_events_created_at ON public.asm_events(created_at DESC);

CREATE INDEX idx_deposits_asm_id ON public.deposits(asm_id);
CREATE INDEX idx_deposits_deposit_date ON public.deposits(deposit_date DESC);
CREATE INDEX idx_deposit_orders_deposit_id ON public.deposit_orders(deposit_id);
CREATE INDEX idx_deposit_orders_order_id ON public.deposit_orders(order_id);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_transactions_updated_at BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Orders policies
CREATE POLICY "Users can view orders based on role"
  ON public.orders FOR SELECT
  USING (
    is_test = false OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    ) OR
    (rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid())) OR
    (asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
  );

CREATE POLICY "Admins can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update orders based on role"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        role = 'finance' OR
        (role = 'asm' AND asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid())) OR
        (role = 'rider' AND rider_id IN (SELECT rider_id FROM public.users WHERE id = auth.uid()))
      )
    )
  );

-- Rider events policies
CREATE POLICY "Users can view rider events"
  ON public.rider_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.users u ON u.id = auth.uid()
      WHERE o.id = rider_events.order_id AND (
        u.role IN ('admin', 'finance', 'viewer') OR
        o.rider_id = u.rider_id OR
        o.asm_id = u.asm_id
      )
    )
  );

CREATE POLICY "Riders can insert their own events"
  ON public.rider_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        (role = 'rider' AND rider_id = rider_events.rider_id)
      )
    )
  );

-- ASM events policies
CREATE POLICY "Users can view ASM events"
  ON public.asm_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.users u ON u.id = auth.uid()
      WHERE o.id = asm_events.order_id AND (
        u.role IN ('admin', 'finance', 'viewer') OR
        o.rider_id = u.rider_id OR
        o.asm_id = u.asm_id
      )
    )
  );

CREATE POLICY "ASMs can insert their own events"
  ON public.asm_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        (role = 'asm' AND asm_id = asm_events.asm_id)
      )
    )
  );

-- Deposits policies
CREATE POLICY "Users can view deposits"
  ON public.deposits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role IN ('admin', 'finance', 'viewer') OR
        (role = 'asm' AND asm_id IN (SELECT asm_id FROM public.users WHERE id = auth.uid()))
      )
    )
  );

CREATE POLICY "ASMs can insert their own deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (
        role = 'admin' OR
        (role = 'asm' AND asm_id = deposits.asm_id)
      )
    )
  );

-- Audit logs policies
CREATE POLICY "Users can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'finance')
    )
  );

-- Create function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Create function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

