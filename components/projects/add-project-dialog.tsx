'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

const processors = [
  { id: 'stripe', name: 'Stripe', description: 'Credit card payments' },
  { id: 'lemonsqueezy', name: 'LemonSqueezy', description: 'Digital products & SaaS' },
  { id: 'strike', name: 'Strike', description: 'Bitcoin & Lightning' },
];

export function AddProjectDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedProcessor, setSelectedProcessor] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProcessor) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('projects').insert({
      user_id: user?.id,
      name,
      processor: selectedProcessor,
      processor_account_id: accountId || null,
      webhook_secret: crypto.randomUUID(), // Generate a random secret
    });

    if (error) {
      console.error('Error creating project:', error);
      setLoading(false);
      return;
    }

    setOpen(false);
    setStep('select');
    setSelectedProcessor(null);
    setName('');
    setAccountId('');
    setLoading(false);
    router.refresh();
  }

  function handleProcessorSelect(processorId: string) {
    setSelectedProcessor(processorId);
    setStep('configure');
  }

  function handleClose() {
    setOpen(false);
    setStep('select');
    setSelectedProcessor(null);
    setName('');
    setAccountId('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === 'select' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add a Project</DialogTitle>
              <DialogDescription>
                Select the payment processor for this project
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {processors.map((processor) => (
                <button
                  key={processor.id}
                  onClick={() => handleProcessorSelect(processor.id)}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {processor.name[0]}
                  </div>
                  <div>
                    <div className="font-medium">{processor.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {processor.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configure {selectedProcessor}</DialogTitle>
              <DialogDescription>
                Enter the details for your project
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="My SaaS App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountId">
                  Account ID{' '}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="accountId"
                  placeholder={
                    selectedProcessor === 'stripe'
                      ? 'acct_xxx'
                      : selectedProcessor === 'lemonsqueezy'
                      ? 'store_xxx'
                      : 'account_xxx'
                  }
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used to match webhooks to this project
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('select')}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading || !name}>
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
