import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PayoutFeed } from '@/components/dashboard/payout-feed';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch stats
  const { data: payouts } = await supabase
    .from('expected_payouts')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  const stats = {
    pending: payouts?.filter((p) => p.status === 'pending').length || 0,
    inTransit: payouts?.filter((p) => p.status === 'in_transit').length || 0,
    landed: payouts?.filter((p) => ['landed', 'reconciled'].includes(p.status)).length || 0,
    failed: payouts?.filter((p) => p.status === 'failed').length || 0,
    pendingAmount:
      payouts
        ?.filter((p) => ['pending', 'in_transit'].includes(p.status))
        .reduce((sum, p) => sum + p.amount, 0) || 0,
    landedAmount:
      payouts
        ?.filter((p) => ['landed', 'reconciled'].includes(p.status))
        .reduce((sum, p) => sum + p.amount, 0) || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Track your payouts across all payment processors
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending + stats.inTransit}</div>
            <p className="text-xs text-muted-foreground">
              ${(stats.pendingAmount / 100).toLocaleString()} awaiting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Landed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.landed}</div>
            <p className="text-xs text-muted-foreground">
              ${(stats.landedAmount / 100).toLocaleString()} received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Received</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.landedAmount / 100).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <PayoutFeed initialPayouts={payouts || []} userId={user?.id || ''} />
        </CardContent>
      </Card>
    </div>
  );
}
