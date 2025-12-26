-- PayDashboard Database Schema
-- Run this in Supabase SQL Editor

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  processor TEXT NOT NULL CHECK (processor IN ('stripe', 'lemonsqueezy', 'strike')),
  processor_account_id TEXT,
  webhook_secret TEXT,
  api_credentials JSONB, -- encrypted in app layer
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expected payouts from processors
CREATE TABLE IF NOT EXISTS expected_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  processor TEXT NOT NULL,
  processor_payout_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- cents
  currency TEXT DEFAULT 'USD',
  expected_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'landed', 'reconciled', 'failed', 'manual')),
  bank_transaction_id UUID,
  processor_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(processor, processor_payout_id)
);

-- Bank transactions from Plaid
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank_connection_id UUID NOT NULL,
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL, -- cents (positive = credit)
  date DATE NOT NULL,
  description TEXT,
  category TEXT,
  matched_payout_id UUID,
  is_potential_payout BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plaid bank connections
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plaid_item_id TEXT UNIQUE NOT NULL,
  plaid_access_token TEXT NOT NULL, -- encrypt in app layer
  institution_name TEXT,
  account_mask TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook logs for debugging
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- stripe, lemonsqueezy, plaid
  event_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for bank_transaction_id after bank_transactions exists
ALTER TABLE expected_payouts
  ADD CONSTRAINT fk_bank_transaction
  FOREIGN KEY (bank_transaction_id)
  REFERENCES bank_transactions(id);

-- Add foreign key for matched_payout_id
ALTER TABLE bank_transactions
  ADD CONSTRAINT fk_matched_payout
  FOREIGN KEY (matched_payout_id)
  REFERENCES expected_payouts(id);

-- Add foreign key for bank_connection_id
ALTER TABLE bank_transactions
  ADD CONSTRAINT fk_bank_connection
  FOREIGN KEY (bank_connection_id)
  REFERENCES bank_connections(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_expected_payouts_user_id ON expected_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_expected_payouts_status ON expected_payouts(status);
CREATE INDEX IF NOT EXISTS idx_expected_payouts_project_id ON expected_payouts(project_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_id ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_connections_user_id ON bank_connections(user_id);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expected_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own projects"
  ON projects FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own payouts"
  ON expected_payouts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own transactions"
  ON bank_transactions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own bank connections"
  ON bank_connections FOR ALL USING (auth.uid() = user_id);

-- Webhook logs: service role only (no user access)
CREATE POLICY "Service role only for webhook logs"
  ON webhook_logs FOR ALL USING (false);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER expected_payouts_updated_at
  BEFORE UPDATE ON expected_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable realtime for payouts (for live dashboard updates)
ALTER PUBLICATION supabase_realtime ADD TABLE expected_payouts;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_transactions;
