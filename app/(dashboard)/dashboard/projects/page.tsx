import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { AddProjectDialog } from '@/components/projects/add-project-dialog';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  const processorColors: Record<string, string> = {
    stripe: 'bg-purple-100 text-purple-800',
    lemonsqueezy: 'bg-yellow-100 text-yellow-800',
    strike: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your connected payment processors
          </p>
        </div>
        <AddProjectDialog />
      </div>

      {projects?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No projects connected yet</p>
            <AddProjectDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <Card key={project.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <Badge className={processorColors[project.processor]}>
                  {project.processor}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Status:{' '}
                    <span
                      className={
                        project.is_active ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {project.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                  {project.processor_account_id && (
                    <p className="truncate">
                      Account: {project.processor_account_id}
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/projects/${project.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Webhook URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add these webhook URLs to your payment processor dashboards:
          </p>
          <div className="space-y-2 text-sm font-mono bg-muted p-4 rounded-md">
            <p>
              <strong>Stripe:</strong>{' '}
              {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}
              /api/webhooks/stripe
            </p>
            <p>
              <strong>LemonSqueezy:</strong>{' '}
              {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}
              /api/webhooks/lemonsqueezy
            </p>
            <p>
              <strong>Strike:</strong>{' '}
              {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}
              /api/webhooks/strike
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
