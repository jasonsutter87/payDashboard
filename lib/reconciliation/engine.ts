import { createAdminClient } from '@/lib/supabase/admin';
import type { ExpectedPayout, BankTransaction, PaymentProcessor } from '@/types';

// Processor hints in bank transaction descriptions
const PROCESSOR_HINTS: Record<PaymentProcessor, string[]> = {
  stripe: ['STRIPE', 'ST-', 'STRIPE TRANSFER'],
  lemonsqueezy: ['LEMON', 'LEMONSQUEEZY', 'LS-', 'GUMROAD'], // LS may use Gumroad infra
  strike: ['STRIKE', 'ZAPHQ', 'ZAP'],
};

/**
 * Check if a bank transaction description matches a processor
 */
function matchesProcessorHint(
  description: string | null,
  processor: PaymentProcessor
): boolean {
  if (!description) return true; // No description = don't filter by it
  const hints = PROCESSOR_HINTS[processor];
  const upperDesc = description.toUpperCase();
  return hints.some((hint) => upperDesc.includes(hint));
}

/**
 * Check if two dates are within a given number of days
 */
function isWithinDays(
  date1: string,
  date2: string | null,
  days: number
): boolean {
  if (!date2) return true; // No expected date = don't filter by it
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

/**
 * Main reconciliation function
 * Matches expected payouts to bank transactions
 */
export async function runReconciliation(userId?: string) {
  const supabase = createAdminClient();

  console.log('Running reconciliation...');

  // Build query for pending payouts
  let payoutsQuery = supabase
    .from('expected_payouts')
    .select('*')
    .in('status', ['pending', 'in_transit'])
    .is('bank_transaction_id', null);

  if (userId) {
    payoutsQuery = payoutsQuery.eq('user_id', userId);
  }

  const { data: pendingPayouts, error: payoutsError } = await payoutsQuery;

  if (payoutsError) {
    console.error('Error fetching pending payouts:', payoutsError);
    throw payoutsError;
  }

  if (!pendingPayouts?.length) {
    console.log('No pending payouts to reconcile');
    return { matched: 0 };
  }

  // Build query for unmatched transactions (credits only)
  let transactionsQuery = supabase
    .from('bank_transactions')
    .select('*')
    .is('matched_payout_id', null)
    .gt('amount', 0); // Credits only

  if (userId) {
    transactionsQuery = transactionsQuery.eq('user_id', userId);
  }

  const { data: unmatchedTransactions, error: transactionsError } =
    await transactionsQuery;

  if (transactionsError) {
    console.error('Error fetching unmatched transactions:', transactionsError);
    throw transactionsError;
  }

  if (!unmatchedTransactions?.length) {
    console.log('No unmatched transactions to reconcile against');
    return { matched: 0 };
  }

  let matchedCount = 0;

  // For each payout, try to find a matching transaction
  for (const payout of pendingPayouts as ExpectedPayout[]) {
    const match = (unmatchedTransactions as BankTransaction[]).find((tx) => {
      // Amount must match exactly
      if (tx.amount !== payout.amount) return false;

      // Date must be within 3 days of expected
      if (!isWithinDays(tx.date, payout.expected_date, 3)) return false;

      // Description should hint at the processor
      if (!matchesProcessorHint(tx.description, payout.processor as PaymentProcessor)) {
        return false;
      }

      return true;
    });

    if (match) {
      await reconcilePayout(supabase, payout.id, match.id);
      matchedCount++;

      // Remove from unmatched list to prevent double-matching
      const index = unmatchedTransactions.findIndex((t) => t.id === match.id);
      if (index > -1) {
        unmatchedTransactions.splice(index, 1);
      }
    }
  }

  console.log(`Reconciliation complete: ${matchedCount} payouts matched`);
  return { matched: matchedCount };
}

/**
 * Link a payout to a bank transaction
 */
async function reconcilePayout(
  supabase: ReturnType<typeof createAdminClient>,
  payoutId: string,
  transactionId: string
) {
  // Update payout
  const { error: payoutError } = await supabase
    .from('expected_payouts')
    .update({
      status: 'landed',
      bank_transaction_id: transactionId,
    })
    .eq('id', payoutId);

  if (payoutError) {
    console.error('Error updating payout:', payoutError);
    throw payoutError;
  }

  // Update transaction
  const { error: txError } = await supabase
    .from('bank_transactions')
    .update({
      matched_payout_id: payoutId,
    })
    .eq('id', transactionId);

  if (txError) {
    console.error('Error updating transaction:', txError);
    throw txError;
  }

  console.log(`Reconciled payout ${payoutId} with transaction ${transactionId}`);
}

/**
 * Manually link a payout to a transaction
 */
export async function manualReconcile(payoutId: string, transactionId: string) {
  const supabase = createAdminClient();

  // Update payout with manual status
  const { error: payoutError } = await supabase
    .from('expected_payouts')
    .update({
      status: 'manual',
      bank_transaction_id: transactionId,
    })
    .eq('id', payoutId);

  if (payoutError) throw payoutError;

  // Update transaction
  const { error: txError } = await supabase
    .from('bank_transactions')
    .update({
      matched_payout_id: payoutId,
    })
    .eq('id', transactionId);

  if (txError) throw txError;

  return { success: true };
}
