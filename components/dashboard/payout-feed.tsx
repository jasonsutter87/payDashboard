'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExpectedPayout } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface PayoutFeedProps {
  initialPayouts: ExpectedPayout[];
  userId: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-blue-100 text-blue-800',
  landed: 'bg-green-100 text-green-800',
  reconciled: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  manual: 'bg-purple-100 text-purple-800',
};

const processorIcons: Record<string, string> = {
  stripe: 'S',
  lemonsqueezy: 'L',
  strike: '⚡',
};

export function PayoutFeed({ initialPayouts, userId }: PayoutFeedProps) {
  const [payouts, setPayouts] = useState<ExpectedPayout[]>(initialPayouts);
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to realtime updates
    const channel = supabase
      .channel('payouts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expected_payouts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPayouts((prev) => [payload.new as ExpectedPayout, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPayouts((prev) =>
              prev.map((p) =>
                p.id === payload.new.id ? (payload.new as ExpectedPayout) : p
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setPayouts((prev) =>
              prev.filter((p) => p.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  if (payouts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No payouts yet.</p>
        <p className="text-sm mt-1">
          Connect your payment processors to start tracking payouts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {payouts.slice(0, 10).map((payout) => (
        <div
          key={payout.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-bold">
              {processorIcons[payout.processor] || '?'}
            </div>
            <div>
              <div className="font-medium">
                ${(payout.amount / 100).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {payout.processor.charAt(0).toUpperCase() +
                  payout.processor.slice(1)}{' '}
                &middot;{' '}
                {formatDistanceToNow(new Date(payout.created_at), {
                  addSuffix: true,
                })}
              </div>
            </div>
          </div>
          <Badge className={statusColors[payout.status] || ''}>
            {payout.status.replace('_', ' ')}
          </Badge>
        </div>
      ))}
    </div>
  );
}
