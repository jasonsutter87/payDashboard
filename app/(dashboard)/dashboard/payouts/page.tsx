import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800',
  landed: 'bg-green-100 text-green-800',
  reconciled: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  manual: 'bg-purple-100 text-purple-800',
};

export default async function PayoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: payouts } = await supabase
    .from('expected_payouts')
    .select('*, projects(name)')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  const pendingPayouts = payouts?.filter((p) =>
    ['pending', 'in_transit'].includes(p.status)
  );
  const completedPayouts = payouts?.filter((p) =>
    ['landed', 'reconciled', 'manual'].includes(p.status)
  );
  const failedPayouts = payouts?.filter((p) => p.status === 'failed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payouts</h1>
        <p className="text-muted-foreground">
          Track all payouts from your payment processors
        </p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({payouts?.length || 0})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingPayouts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedPayouts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed ({failedPayouts?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <PayoutsTable payouts={payouts || []} />
        </TabsContent>
        <TabsContent value="pending">
          <PayoutsTable payouts={pendingPayouts || []} />
        </TabsContent>
        <TabsContent value="completed">
          <PayoutsTable payouts={completedPayouts || []} />
        </TabsContent>
        <TabsContent value="failed">
          <PayoutsTable payouts={failedPayouts || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PayoutWithProject {
  id: string;
  processor: string;
  processor_payout_id: string;
  amount: number;
  currency: string;
  status: string;
  expected_date: string | null;
  created_at: string;
  projects: { name: string } | null;
}

function PayoutsTable({ payouts }: { payouts: PayoutWithProject[] }) {
  if (payouts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No payouts found
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Processor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell className="font-medium">
                  {payout.projects?.name || 'Unknown'}
                </TableCell>
                <TableCell className="capitalize">{payout.processor}</TableCell>
                <TableCell>
                  ${(payout.amount / 100).toLocaleString()}{' '}
                  <span className="text-muted-foreground text-xs">
                    {payout.currency}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[payout.status]}>
                    {payout.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {payout.expected_date
                    ? format(new Date(payout.expected_date), 'MMM d, yyyy')
                    : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(payout.created_at), 'MMM d, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
