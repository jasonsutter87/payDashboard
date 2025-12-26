import { NextRequest, NextResponse } from 'next/server';
import { runReconciliation } from '@/lib/reconciliation/engine';

// This endpoint can be called by Vercel Cron or any external cron service
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/reconcile",
//     "schedule": "*/15 * * * *"
//   }]
// }

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, always verify the secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Running scheduled reconciliation...');
    const result = await runReconciliation();
    console.log('Reconciliation complete:', result);

    return NextResponse.json({
      success: true,
      matched: result.matched,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
