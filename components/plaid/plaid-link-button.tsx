'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConnect = useCallback(async () => {
    setLoading(true);

    try {
      // Get link token from our API
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const { link_token } = await response.json();

      // Dynamically import Plaid Link
      const { usePlaidLink } = await import('react-plaid-link');

      // For now, we'll use a simple approach
      // In production, you'd use the usePlaidLink hook properly
      // This is a simplified version for the scaffold

      // Store the link token and redirect to a page that handles Plaid Link
      sessionStorage.setItem('plaid_link_token', link_token);

      // Open Plaid Link in a new flow
      // In a real implementation, you'd use the usePlaidLink hook
      // For now, we'll show an alert with instructions
      alert(
        'Plaid Link token created! In production, this would open the Plaid Link UI. ' +
          'Token: ' +
          link_token.substring(0, 20) +
          '...'
      );

      router.refresh();
    } catch (error) {
      console.error('Error connecting bank:', error);
      alert('Failed to initialize bank connection. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  return (
    <Button onClick={handleConnect} disabled={loading} variant={variant}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
