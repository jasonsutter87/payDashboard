import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NormalizedPayout } from '@/types';

// Lazy initialization to avoid build errors
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Log the webhook
  await supabase.from('webhook_logs').insert({
    source: 'stripe',
    event_type: event.type,
    payload: event.data.object,
  });

  try {
    switch (event.type) {
      case 'payout.created':
      case 'payout.updated':
      case 'payout.paid':
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        await handlePayout(supabase, payout, event.type);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handlePayout(
  supabase: ReturnType<typeof createAdminClient>,
  payout: Stripe.Payout,
  eventType: string
) {
  // Map Stripe status to our status
  const statusMap: Record<string, NormalizedPayout['status']> = {
    pending: 'pending',
    in_transit: 'in_transit',
    paid: 'in_transit', // "paid" from Stripe means sent, not landed
    failed: 'failed',
    canceled: 'failed',
  };

  const status = statusMap[payout.status] || 'pending';

  // Find the project by Stripe account (for Connect) or default
  // For now, we'll need to match by looking up existing projects
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('processor', 'stripe')
    .eq('is_active', true)
    .single();

  if (!project) {
    console.log('No active Stripe project found');
    return;
  }

  // Upsert the payout
  const { error } = await supabase.from('expected_payouts').upsert(
    {
      user_id: project.user_id,
      project_id: project.id,
      processor: 'stripe',
      processor_payout_id: payout.id,
      amount: payout.amount,
      currency: payout.currency.toUpperCase(),
      expected_date: payout.arrival_date
        ? new Date(payout.arrival_date * 1000).toISOString().split('T')[0]
        : null,
      status,
      processor_metadata: {
        description: payout.description,
        method: payout.method,
        type: payout.type,
        event_type: eventType,
      },
    },
    {
      onConflict: 'processor,processor_payout_id',
    }
  );

  if (error) {
    console.error('Error upserting payout:', error);
    throw error;
  }

  console.log(`Processed Stripe payout ${payout.id} with status ${status}`);
}
