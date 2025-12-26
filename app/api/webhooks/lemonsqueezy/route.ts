import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;

interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: Record<string, unknown>;
  };
  data: {
    id: string;
    type: string;
    attributes: {
      store_id: number;
      status: string;
      amount: number;
      currency: string;
      payout_date?: string;
      [key: string]: unknown;
    };
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  // Verify HMAC signature
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = hmac.update(body).digest('hex');

  if (signature !== digest) {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const payload: LemonSqueezyWebhookPayload = JSON.parse(body);
  const supabase = createAdminClient();

  // Log the webhook
  await supabase.from('webhook_logs').insert({
    source: 'lemonsqueezy',
    event_type: payload.meta.event_name,
    payload: payload.data,
  });

  try {
    const eventName = payload.meta.event_name;

    // Handle payout-related events
    // LemonSqueezy does payouts on a schedule, so we track subscription payments
    // and the actual payout events when available
    switch (eventName) {
      case 'subscription_payment_success':
      case 'order_created':
        // These represent revenue, not payouts
        // Could track for forecasting
        console.log(`Received ${eventName} - revenue tracking`);
        break;

      case 'subscription_payment_refunded':
        // Handle refunds
        console.log('Received refund event');
        break;

      // LemonSqueezy payout events (if available)
      case 'payout_created':
      case 'payout_completed':
        await handlePayout(supabase, payload);
        break;

      default:
        console.log(`Unhandled LemonSqueezy event: ${eventName}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handlePayout(
  supabase: ReturnType<typeof createAdminClient>,
  payload: LemonSqueezyWebhookPayload
) {
  const { data, meta } = payload;
  const attributes = data.attributes;

  // Find the project by LemonSqueezy store ID
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('processor', 'lemonsqueezy')
    .eq('is_active', true)
    .single();

  if (!project) {
    console.log('No active LemonSqueezy project found');
    return;
  }

  // Map status
  const status =
    meta.event_name === 'payout_completed' ? 'in_transit' : 'pending';

  // Upsert the payout
  const { error } = await supabase.from('expected_payouts').upsert(
    {
      user_id: project.user_id,
      project_id: project.id,
      processor: 'lemonsqueezy',
      processor_payout_id: data.id,
      amount: Math.round(attributes.amount * 100), // Convert to cents
      currency: attributes.currency?.toUpperCase() || 'USD',
      expected_date: attributes.payout_date || null,
      status,
      processor_metadata: {
        store_id: attributes.store_id,
        event_name: meta.event_name,
      },
    },
    {
      onConflict: 'processor,processor_payout_id',
    }
  );

  if (error) {
    console.error('Error upserting LemonSqueezy payout:', error);
    throw error;
  }

  console.log(`Processed LemonSqueezy payout ${data.id}`);
}
