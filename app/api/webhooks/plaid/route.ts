import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncTransactions } from '@/lib/plaid/sync';

// Plaid webhook types
interface PlaidWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  // Plaid webhooks can be verified using the Plaid-Verification header
  // For now, we'll process all incoming webhooks
  // TODO: Add Plaid webhook verification
  // https://plaid.com/docs/api/webhooks/webhook-verification/

  const payload: PlaidWebhookPayload = JSON.parse(body);
  const supabase = createAdminClient();

  // Log the webhook
  await supabase.from('webhook_logs').insert({
    source: 'plaid',
    event_type: `${payload.webhook_type}.${payload.webhook_code}`,
    payload: payload,
  });

  try {
    const { webhook_type, webhook_code, item_id } = payload;

    console.log(`Plaid webhook: ${webhook_type}.${webhook_code} for item ${item_id}`);

    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionWebhook(supabase, payload);
        break;

      case 'ITEM':
        await handleItemWebhook(supabase, payload);
        break;

      default:
        console.log(`Unhandled Plaid webhook type: ${webhook_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Plaid webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handleTransactionWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  payload: PlaidWebhookPayload
) {
  const { webhook_code, item_id } = payload;

  // Find the bank connection
  const { data: connection } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('plaid_item_id', item_id)
    .single();

  if (!connection) {
    console.log(`No bank connection found for item ${item_id}`);
    return;
  }

  switch (webhook_code) {
    case 'SYNC_UPDATES_AVAILABLE':
    case 'DEFAULT_UPDATE':
    case 'HISTORICAL_UPDATE':
      // Sync new transactions
      console.log(`Syncing transactions for item ${item_id}`);
      await syncTransactions(connection.id);
      break;

    case 'TRANSACTIONS_REMOVED':
      // Handle removed transactions
      if (payload.removed_transactions?.length) {
        await supabase
          .from('bank_transactions')
          .delete()
          .in('plaid_transaction_id', payload.removed_transactions);
        console.log(`Removed ${payload.removed_transactions.length} transactions`);
      }
      break;

    default:
      console.log(`Unhandled transaction webhook code: ${webhook_code}`);
  }
}

async function handleItemWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  payload: PlaidWebhookPayload
) {
  const { webhook_code, item_id, error } = payload;

  switch (webhook_code) {
    case 'ERROR':
      // Mark connection as needing attention
      console.error(`Plaid item error for ${item_id}:`, error);
      await supabase
        .from('bank_connections')
        .update({ is_active: false })
        .eq('plaid_item_id', item_id);
      break;

    case 'PENDING_EXPIRATION':
      // User needs to re-authenticate
      console.log(`Plaid item ${item_id} pending expiration`);
      break;

    default:
      console.log(`Unhandled item webhook code: ${webhook_code}`);
  }
}
