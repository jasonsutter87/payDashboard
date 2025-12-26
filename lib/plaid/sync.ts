import { plaidClient } from './client';
import { createAdminClient } from '@/lib/supabase/admin';
import { runReconciliation } from '@/lib/reconciliation/engine';

export async function syncTransactions(bankConnectionId: string) {
  const supabase = createAdminClient();

  // Get the bank connection
  const { data: connection, error: connError } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('id', bankConnectionId)
    .single();

  if (connError || !connection) {
    throw new Error(`Bank connection not found: ${bankConnectionId}`);
  }

  try {
    // Use Plaid's transactions sync endpoint
    const response = await plaidClient.transactionsSync({
      access_token: connection.plaid_access_token,
    });

    const { added, modified, removed } = response.data;

    // Process added transactions
    for (const transaction of added) {
      // Only track credits (positive amounts from our perspective)
      // Plaid reports credits as negative, so we flip the sign
      const amount = Math.round(-transaction.amount * 100); // Convert to cents

      // Determine if this could be a payout (credits > $50)
      const isPotentialPayout = amount > 5000;

      await supabase.from('bank_transactions').upsert(
        {
          user_id: connection.user_id,
          bank_connection_id: connection.id,
          plaid_transaction_id: transaction.transaction_id,
          amount,
          date: transaction.date,
          description: transaction.name || transaction.merchant_name,
          category: transaction.personal_finance_category?.primary || null,
          is_potential_payout: isPotentialPayout,
        },
        {
          onConflict: 'plaid_transaction_id',
        }
      );
    }

    // Process modified transactions
    for (const transaction of modified) {
      const amount = Math.round(-transaction.amount * 100);
      const isPotentialPayout = amount > 5000;

      await supabase
        .from('bank_transactions')
        .update({
          amount,
          date: transaction.date,
          description: transaction.name || transaction.merchant_name,
          category: transaction.personal_finance_category?.primary || null,
          is_potential_payout: isPotentialPayout,
        })
        .eq('plaid_transaction_id', transaction.transaction_id);
    }

    // Process removed transactions
    for (const transactionId of removed) {
      await supabase
        .from('bank_transactions')
        .delete()
        .eq('plaid_transaction_id', transactionId);
    }

    // Update last synced timestamp
    await supabase
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', bankConnectionId);

    console.log(
      `Synced transactions: ${added.length} added, ${modified.length} modified, ${removed.length} removed`
    );

    // Run reconciliation after sync
    await runReconciliation(connection.user_id);

    return {
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    };
  } catch (error) {
    console.error('Error syncing transactions:', error);
    throw error;
  }
}
