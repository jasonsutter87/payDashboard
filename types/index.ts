// Payment processor types
export type PaymentProcessor = 'stripe' | 'lemonsqueezy' | 'strike';

export type PayoutStatus =
  | 'pending'      // Webhook received, awaiting bank deposit
  | 'in_transit'   // Processor says "paid", not yet in bank
  | 'landed'       // Matched to bank transaction
  | 'reconciled'   // Confirmed and closed
  | 'failed'       // Payout failed at processor
  | 'manual';      // Manually linked by user

// Normalized payout from any processor
export interface NormalizedPayout {
  processor: PaymentProcessor;
  processorPayoutId: string;
  amount: number; // in cents
  currency: string;
  expectedDate: Date;
  status: PayoutStatus;
  metadata: Record<string, unknown>;
}

// Database types
export interface Project {
  id: string;
  user_id: string;
  name: string;
  processor: PaymentProcessor;
  processor_account_id: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpectedPayout {
  id: string;
  user_id: string;
  project_id: string;
  processor: PaymentProcessor;
  processor_payout_id: string;
  amount: number;
  currency: string;
  expected_date: string | null;
  status: PayoutStatus;
  bank_transaction_id: string | null;
  processor_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  user_id: string;
  bank_connection_id: string;
  plaid_transaction_id: string;
  amount: number;
  date: string;
  description: string | null;
  category: string | null;
  matched_payout_id: string | null;
  is_potential_payout: boolean;
  created_at: string;
}

export interface BankConnection {
  id: string;
  user_id: string;
  plaid_item_id: string;
  plaid_access_token: string;
  institution_name: string | null;
  account_mask: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Dashboard stats
export interface DashboardStats {
  totalPending: number;
  totalLanded: number;
  pendingAmount: number;
  landedAmount: number;
  recentPayouts: ExpectedPayout[];
}
