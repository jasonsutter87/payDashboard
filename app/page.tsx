import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Zap, Shield, BarChart } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="text-xl font-bold">PayDashboard</span>
          <div className="flex gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Track payouts across all your
            <br />
            <span className="text-primary">payment processors</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect Stripe, LemonSqueezy, Strike and your bank account.
            See when money actually lands in your account, not just when
            processors say they sent it.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/signup">Start tracking payouts</Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold">Real-time Updates</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              See payouts appear instantly via webhooks from all processors
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold">Bank Verification</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Plaid confirms when money actually lands in your bank
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Shield className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold">Auto Reconciliation</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Automatically match payouts to bank deposits
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold">Multi-Project</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Track all your SaaS products in one unified dashboard
            </p>
          </div>
        </div>

        {/* Processors */}
        <div className="mt-32 text-center">
          <p className="text-muted-foreground">Works with</p>
          <div className="mt-6 flex items-center justify-center gap-12 text-2xl font-bold text-muted-foreground/50">
            <span>Stripe</span>
            <span>LemonSqueezy</span>
            <span>Strike</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-32">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          PayDashboard - Track your payouts, verify your revenue
        </div>
      </footer>
    </div>
  );
}
