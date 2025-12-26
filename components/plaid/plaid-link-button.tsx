'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface PlaidLinkButtonProps {
  children?: React.ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

export function PlaidLinkButton({
  children = 'Connect Bank',
  variant = 'default',
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Fetch link token on mount
  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const response = await fetch('/api/plaid/create-link-token', {
          method: 'POST',
        });

        if (response.ok) {
          const { link_token } = await response.json();
          setLinkToken(link_token);
        }
      } catch (error) {
        console.error('Error fetching link token:', error);
      }
    }

    fetchLinkToken();
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      setLoading(true);
      try {
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_token: publicToken,
            metadata,
          }),
        });

        if (response.ok) {
          router.refresh();
        } else {
          console.error('Failed to exchange token');
        }
      } catch (error) {
        console.error('Error exchanging token:', error);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (error) => {
      if (error) {
        console.error('Plaid Link exited with error:', error);
      }
    },
  });

  const handleClick = () => {
    if (ready) {
      open();
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={!ready || loading}
      variant={variant}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : !ready ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
