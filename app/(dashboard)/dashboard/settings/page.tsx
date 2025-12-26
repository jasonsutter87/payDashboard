import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { Badge } from '@/components/ui/badge';
import { Landmark, Check } from 'lucide-react';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bankConnections } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your bank connections and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Bank Connection
          </CardTitle>
          <CardDescription>
            Connect your bank account via Plaid to verify when payouts land
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bankConnections && bankConnections.length > 0 ? (
            <div className="space-y-4">
              {bankConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {connection.institution_name || 'Bank Account'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ****{connection.account_mask || '****'}
                      </div>
                    </div>
                  </div>
                  <Badge variant={connection.is_active ? 'default' : 'secondary'}>
                    {connection.is_active ? 'Connected' : 'Needs attention'}
                  </Badge>
                </div>
              ))}
              <div className="pt-4">
                <PlaidLinkButton variant="outline">
                  Connect Another Account
                </PlaidLinkButton>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Landmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No bank account connected yet
              </p>
              <PlaidLinkButton>Connect Bank Account</PlaidLinkButton>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              <strong>Email:</strong> {user?.email}
            </p>
            <p className="text-sm text-muted-foreground">
              Account created:{' '}
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
