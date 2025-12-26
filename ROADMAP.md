# PayDashboard - Unified SaaS Payout Tracking

A real-time dashboard that aggregates payouts from multiple payment processors (Stripe, Strike, LemonSqueezy) and reconciles them against your actual bank account via Plaid.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAYMENT PROCESSORS                          │
├──────────────────┬──────────────────┬──────────────────────────────┤
│      Stripe      │      Strike      │        LemonSqueezy          │
│   (webhook)      │    (webhook)     │          (webhook)           │
└────────┬─────────┴────────┬─────────┴──────────────┬───────────────┘
         │                  │                        │
         ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      WEBHOOK INGESTION LAYER                        │
│              (Serverless Functions / API Routes)                    │
│                                                                     │
│   - Validate signatures                                             │
│   - Normalize payout data                                           │
│   - Insert into "expected_payouts" table                            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DATABASE (Postgres)                        │
├─────────────────────────────────────────────────────────────────────┤
│  projects          │  expected_payouts      │  bank_transactions    │
│  ─────────         │  ─────────────────     │  ──────────────────   │
│  id                │  id                    │  id                   │
│  name              │  project_id            │  plaid_transaction_id │
│  processor         │  processor             │  amount               │
│  processor_id      │  payout_id             │  date                 │
│  created_at        │  amount                │  description          │
│                    │  expected_date         │  matched_payout_id    │
│                    │  status (pending/      │  created_at           │
│                    │   landed/reconciled)   │                       │
│                    │  bank_transaction_id   │                       │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        RECONCILIATION ENGINE                        │
│                                                                     │
│   Triggered by:                                                     │
│   - New bank transaction (Plaid webhook)                            │
│   - Cron job (every 15 min for polling fallback)                    │
│                                                                     │
│   Logic:                                                            │
│   1. Find unmatched expected_payouts                                │
│   2. Find unmatched bank_transactions                               │
│   3. Match by: amount + date range (±3 days) + processor hint       │
│   4. Update status to "reconciled"                                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME LAYER                             │
│                                                                     │
│   Option A: Supabase Realtime (Postgres changes → WebSocket)        │
│   Option B: Pusher/Ably (explicit publish on status change)         │
│   Option C: Server-Sent Events (simpler, no third party)            │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                        │
│                                                                     │
│   Pages:                                                            │
│   - /dashboard          → Overview of all projects + recent payouts │
│   - /projects           → Manage connected SaaS projects            │
│   - /projects/[id]      → Single project payout history             │
│   - /settings           → Plaid connection, preferences             │
│   - /connect/[provider] → OAuth flows for payment processors        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack (Recommended)

| Layer              | Technology                | Why                                      |
|--------------------|---------------------------|------------------------------------------|
| Framework          | Next.js 14 (App Router)   | Full-stack, API routes, easy deployment  |
| Database           | Supabase (Postgres)       | Free tier, built-in realtime, auth       |
| Real-time          | Supabase Realtime         | Already included, no extra service       |
| Bank Connection    | Plaid                     | Industry standard, good webhooks         |
| Auth               | Supabase Auth / Clerk     | Simple, secure                           |
| Styling            | Tailwind + shadcn/ui      | Fast to build, good defaults             |
| Deployment         | Vercel                    | Free tier, serverless functions          |
| Cron Jobs          | Vercel Cron / Inngest     | For polling fallback                     |

---

## Phase 1: Foundation (MVP)

### 1.1 Project Setup
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Set up Supabase project (database + auth)
- [ ] Configure Tailwind + shadcn/ui
- [ ] Set up environment variables structure
- [ ] Create basic layout and navigation

### 1.2 Database Schema
- [ ] Create `users` table (handled by Supabase Auth)
- [ ] Create `projects` table
- [ ] Create `expected_payouts` table
- [ ] Create `bank_transactions` table
- [ ] Create `bank_connections` table (Plaid tokens)
- [ ] Set up Row Level Security (RLS) policies

### 1.3 Authentication
- [ ] Implement sign up / sign in flows
- [ ] Protected routes middleware
- [ ] User settings page

---

## Phase 2: Payment Processor Integrations

### 2.1 Stripe Integration
- [ ] Create webhook endpoint `/api/webhooks/stripe`
- [ ] Handle `payout.created` event
- [ ] Handle `payout.paid` event
- [ ] Handle `payout.failed` event
- [ ] Signature verification
- [ ] Store Stripe Connect account ID per project

**Stripe Payout Webhook Payload (key fields):**
```json
{
  "id": "po_1ABC123",
  "object": "payout",
  "amount": 10000,
  "arrival_date": 1234567890,
  "status": "paid",
  "description": "STRIPE PAYOUT"
}
```

### 2.2 Strike Integration
- [ ] Create webhook endpoint `/api/webhooks/strike`
- [ ] Handle payout events
- [ ] Signature verification
- [ ] Store Strike API credentials per project

**Strike Webhook Events:**
- `payment.completed`
- `withdrawal.completed`

### 2.3 LemonSqueezy Integration
- [ ] Create webhook endpoint `/api/webhooks/lemonsqueezy`
- [ ] Handle `subscription_payment_success` event
- [ ] Handle payout-related events
- [ ] Signature verification (HMAC)
- [ ] Store LemonSqueezy store ID per project

**LemonSqueezy Note:**
LemonSqueezy aggregates payments and does payouts on a schedule.
Check their API for payout reporting endpoints.

### 2.4 Webhook Handler Pattern
```typescript
// Normalized payout structure
interface NormalizedPayout {
  processor: 'stripe' | 'strike' | 'lemonsqueezy';
  processorPayoutId: string;
  amount: number; // in cents
  currency: string;
  expectedDate: Date;
  status: 'pending' | 'in_transit' | 'paid' | 'failed';
  metadata: Record<string, any>;
}
```

---

## Phase 3: Bank Connection (Plaid)

### 3.1 Plaid Setup
- [ ] Create Plaid developer account
- [ ] Set up Plaid Link integration
- [ ] Create `/api/plaid/create-link-token` endpoint
- [ ] Create `/api/plaid/exchange-token` endpoint
- [ ] Store access tokens securely (encrypted)

### 3.2 Transaction Syncing
- [ ] Implement initial transaction sync on connection
- [ ] Set up Plaid webhooks for new transactions
  - `TRANSACTIONS_SYNC` webhook
  - `DEFAULT_UPDATE` webhook
- [ ] Create `/api/webhooks/plaid` endpoint
- [ ] Store transactions in `bank_transactions` table

### 3.3 Plaid Webhook Events
```
TRANSACTIONS:
- SYNC_UPDATES_AVAILABLE  → New transactions ready
- DEFAULT_UPDATE          → Daily update available
- HISTORICAL_UPDATE       → Historical data ready
```

---

## Phase 4: Reconciliation Engine

### 4.1 Matching Algorithm
```typescript
async function reconcilePayouts() {
  // 1. Get unmatched expected payouts
  const pendingPayouts = await db.expectedPayouts
    .where({ status: 'pending' })
    .orWhere({ status: 'in_transit' });

  // 2. Get unmatched bank transactions (credits only)
  const unmatchedTransactions = await db.bankTransactions
    .where({ matchedPayoutId: null })
    .andWhere({ amount: '>', 0 }); // Credits only

  // 3. For each payout, find matching transaction
  for (const payout of pendingPayouts) {
    const match = unmatchedTransactions.find(tx =>
      // Amount must match exactly (in cents)
      tx.amount === payout.amount &&
      // Date within ±3 days of expected
      isWithinDays(tx.date, payout.expectedDate, 3) &&
      // Optional: description contains processor hint
      matchesProcessorHint(tx.description, payout.processor)
    );

    if (match) {
      await reconcilePayout(payout.id, match.id);
    }
  }
}

function matchesProcessorHint(description: string, processor: string): boolean {
  const hints = {
    stripe: ['STRIPE', 'ST-'],
    strike: ['STRIKE', 'ZAPHQ'],
    lemonsqueezy: ['LEMON', 'LEMONSQUEEZY', 'LS-']
  };
  return hints[processor]?.some(h =>
    description.toUpperCase().includes(h)
  ) ?? true;
}
```

### 4.2 Reconciliation Triggers
- [ ] On new Plaid transaction webhook
- [ ] On new payout webhook
- [ ] Cron job every 15 minutes (fallback)
- [ ] Manual reconciliation button in UI

### 4.3 Edge Cases
- [ ] Handle partial matches (close amounts)
- [ ] Handle duplicate detection
- [ ] Handle failed payouts
- [ ] Handle manual override/linking
- [ ] Handle currency conversion (if applicable)

---

## Phase 5: Real-time UI

### 5.1 Supabase Realtime Setup
```typescript
// Subscribe to payout changes
const subscription = supabase
  .channel('payouts')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'expected_payouts',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      // Update local state
      handlePayoutChange(payload);
    }
  )
  .subscribe();
```

### 5.2 Dashboard Components
- [ ] `<PayoutFeed />` - Real-time list of recent payouts
- [ ] `<PayoutStatusBadge />` - Visual status indicator
- [ ] `<ProjectCard />` - Summary per project
- [ ] `<ReconciliationStatus />` - Match status indicator
- [ ] `<TotalEarnings />` - Aggregated earnings widget
- [ ] `<PayoutTimeline />` - Visual timeline of payouts

### 5.3 Status States
```
PENDING      → Webhook received, awaiting bank deposit
IN_TRANSIT   → Processor says "paid", not yet in bank
LANDED       → Matched to bank transaction
RECONCILED   → Confirmed and closed
FAILED       → Payout failed at processor
MANUAL       → Manually linked by user
```

---

## Phase 6: Project Management UI

### 6.1 Add Project Flow
1. User clicks "Add Project"
2. Select processor (Stripe/Strike/LemonSqueezy)
3. OAuth or API key entry
4. Webhook URL displayed for user to add in processor dashboard
5. Test webhook button
6. Project created

### 6.2 Project Settings
- [ ] Edit project name
- [ ] Regenerate webhook secret
- [ ] View webhook logs
- [ ] Disconnect project
- [ ] View payout history

---

## Phase 7: Polish & Production

### 7.1 Error Handling
- [ ] Webhook failure retry queue
- [ ] Plaid token refresh handling
- [ ] Graceful degradation when services down
- [ ] Error notification system

### 7.2 Security
- [ ] Encrypt stored API keys/tokens
- [ ] Rate limiting on API routes
- [ ] Webhook signature verification (all providers)
- [ ] Audit logging
- [ ] HTTPS only

### 7.3 Notifications
- [ ] Email on successful payout landed
- [ ] Email on failed payout
- [ ] Weekly summary email
- [ ] In-app notification center

### 7.4 Analytics
- [ ] Monthly revenue per project
- [ ] Payout frequency analysis
- [ ] Average time to land
- [ ] Historical charts

---

## Database Schema (SQL)

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  processor TEXT NOT NULL CHECK (processor IN ('stripe', 'strike', 'lemonsqueezy')),
  processor_account_id TEXT,
  webhook_secret TEXT,
  api_credentials JSONB, -- encrypted
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expected payouts from processors
CREATE TABLE expected_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  processor TEXT NOT NULL,
  processor_payout_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- cents
  currency TEXT DEFAULT 'USD',
  expected_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'landed', 'reconciled', 'failed', 'manual')),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  processor_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(processor, processor_payout_id)
);

-- Bank transactions from Plaid
CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL, -- cents (positive = credit)
  date DATE NOT NULL,
  description TEXT,
  category TEXT,
  matched_payout_id UUID REFERENCES expected_payouts(id),
  is_potential_payout BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plaid bank connections
CREATE TABLE bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id TEXT UNIQUE NOT NULL,
  plaid_access_token TEXT NOT NULL, -- encrypt this
  institution_name TEXT,
  account_mask TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook logs for debugging
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- stripe, strike, lemonsqueezy, plaid
  event_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expected_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own projects"
  ON projects FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own payouts"
  ON expected_payouts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own transactions"
  ON bank_transactions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own bank connections"
  ON bank_connections FOR ALL USING (auth.uid() = user_id);
```

---

## API Routes Structure

```
/api
├── /auth
│   └── /callback          # OAuth callbacks
├── /webhooks
│   ├── /stripe            # Stripe payout webhooks
│   ├── /strike            # Strike webhooks
│   ├── /lemonsqueezy      # LemonSqueezy webhooks
│   └── /plaid             # Plaid transaction webhooks
├── /plaid
│   ├── /create-link-token # Initialize Plaid Link
│   ├── /exchange-token    # Exchange public token
│   └── /sync-transactions # Manual sync trigger
├── /projects
│   ├── GET /              # List user's projects
│   ├── POST /             # Create project
│   ├── GET /[id]          # Get project details
│   ├── PATCH /[id]        # Update project
│   └── DELETE /[id]       # Delete project
├── /payouts
│   ├── GET /              # List payouts (filterable)
│   └── POST /[id]/reconcile # Manual reconciliation
└── /cron
    └── /reconcile         # Cron job endpoint
```

---

## Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox # sandbox | development | production

# Stripe (for webhook verification)
STRIPE_WEBHOOK_SECRET=

# Strike
STRIKE_WEBHOOK_SECRET=

# LemonSqueezy
LEMONSQUEEZY_WEBHOOK_SECRET=

# Encryption (for storing tokens)
ENCRYPTION_KEY=
```

---

## File Structure

```
paydashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Main dashboard
│   │   ├── projects/
│   │   │   ├── page.tsx          # Projects list
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   ├── payouts/
│   │   │   └── page.tsx          # All payouts view
│   │   └── settings/
│   │       └── page.tsx          # User settings + Plaid
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── stripe/route.ts
│   │   │   ├── strike/route.ts
│   │   │   ├── lemonsqueezy/route.ts
│   │   │   └── plaid/route.ts
│   │   ├── plaid/
│   │   │   ├── create-link-token/route.ts
│   │   │   ├── exchange-token/route.ts
│   │   │   └── sync/route.ts
│   │   ├── projects/
│   │   └── cron/
│   │       └── reconcile/route.ts
│   ├── layout.tsx
│   └── page.tsx                  # Landing page
├── components/
│   ├── ui/                       # shadcn components
│   ├── dashboard/
│   │   ├── payout-feed.tsx
│   │   ├── project-card.tsx
│   │   ├── status-badge.tsx
│   │   └── earnings-chart.tsx
│   ├── plaid/
│   │   └── plaid-link-button.tsx
│   └── projects/
│       └── add-project-wizard.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── plaid/
│   │   └── client.ts
│   ├── processors/
│   │   ├── stripe.ts
│   │   ├── strike.ts
│   │   └── lemonsqueezy.ts
│   ├── reconciliation/
│   │   └── engine.ts
│   └── utils/
│       ├── encryption.ts
│       └── currency.ts
├── types/
│   └── index.ts
└── ...config files
```

---

## Getting Started (Commands)

```bash
# 1. Create Next.js project
npx create-next-app@latest paydashboard --typescript --tailwind --eslint --app --src-dir=false

# 2. Install dependencies
cd paydashboard
npm install @supabase/supabase-js @supabase/ssr
npm install plaid
npm install stripe
npm install lucide-react
npm install date-fns
npm install zod

# 3. Add shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card badge table dialog input label

# 4. Set up Supabase
# - Create project at supabase.com
# - Run SQL schema above
# - Copy credentials to .env.local
```

---

## Timeline-Free Milestones

1. **Milestone 1**: Auth + basic dashboard layout + projects CRUD
2. **Milestone 2**: Stripe webhook integration (one processor working end-to-end)
3. **Milestone 3**: Plaid integration + transaction syncing
4. **Milestone 4**: Reconciliation engine + real-time updates
5. **Milestone 5**: Add Strike + LemonSqueezy
6. **Milestone 6**: Polish, notifications, analytics
7. **Milestone 7**: Production hardening + launch

---

## Decisions Made

1. **Multi-tenant or single-user?**
   - **DECIDED: Single-user per instance**
   - Simplifies auth (can even skip it for local/self-hosted)
   - No team management needed
   - Simpler RLS policies

2. **Which processor first?**
   - **DECIDED: Stripe + LemonSqueezy**
   - Stripe: Best webhook docs, easiest to test
   - LemonSqueezy: Good for digital products
   - Strike: Add later if needed

3. **Auth approach?**
   - **DECIDED: Supabase Auth**
   - Future-proof, handles sessions properly
   - Easy to add magic link / OAuth later

4. **Plaid pricing consideration**
   - Free tier: 100 Items (bank connections)
   - Dev tier needed for production

---

## Resources

- [Stripe Payout Webhooks](https://stripe.com/docs/api/payouts)
- [Strike API Docs](https://docs.strike.me/)
- [LemonSqueezy API](https://docs.lemonsqueezy.com/api)
- [Plaid Quickstart](https://plaid.com/docs/quickstart/)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
