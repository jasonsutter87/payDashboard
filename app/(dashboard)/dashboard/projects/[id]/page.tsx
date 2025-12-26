import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800',
  landed: 'bg-green-100 text-green-800',
  reconciled: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  manual: 'bg-purple-100 text-purple-800',
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user?.id)
    .single();

  if (!project) {
    notFound();
  }

  const { data: payouts } = await supabase
    .from('expected_payouts')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  const stats = {
    total: payouts?.length || 0,
    pending: payouts?.filter((p) => ['pending', 'in_transit'].includes(p.status)).length || 0,
    landed: payouts?.filter((p) => ['landed', 'reconciled'].includes(p.status)).length || 0,
    totalAmount: payouts?.reduce((sum, p) => sum + p.amount, 0) || 0,
  };

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/webhooks/${project.processor}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground capitalize">{project.processor}</p>
        </div>
        <Badge
          className={project.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
        >
          {project.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Landed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.landed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.totalAmount / 100).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Add this webhook URL to your {project.processor} dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-md text-sm font-mono">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {project.processor === 'stripe' && (
            <Button variant="outline" asChild>
              <a
                href="https://dashboard.stripe.com/webhooks"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Stripe Webhooks <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          {project.processor === 'lemonsqueezy' && (
            <Button variant="outline" asChild>
              <a
                href="https://app.lemonsqueezy.com/settings/webhooks"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open LemonSqueezy Webhooks <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts && payouts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payout ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-sm">
                      {payout.processor_payout_id.substring(0, 20)}...
                    </TableCell>
                    <TableCell>
                      ${(payout.amount / 100).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[payout.status]}>
                        {payout.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payout.expected_date
                        ? format(new Date(payout.expected_date), 'MMM d')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(payout.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No payouts yet. Webhooks will appear here once configured.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
