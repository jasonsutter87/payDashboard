# Before Go Live Checklist

Complete these steps to get PayDashboard running in production.

---

## 1. Supabase Setup (Database + Auth)

### Create Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose a name and strong database password
4. Select a region close to your users
5. Wait for project to provision (~2 min)

### Get API Keys
1. Go to **Settings → API**
2. Copy these values to your `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   ```

### Run Database Schema
1. Go to **SQL Editor** in Supabase dashboard
2. Open `supabase/schema.sql` from this project
3. Paste the entire contents and click "Run"
4. Verify tables were created in **Table Editor**

### Enable Realtime
1. Go to **Database → Replication**
2. Enable replication for:
   - `expected_payouts`
   - `bank_transactions`

---

## 2. Plaid Setup (Bank Connection)

### Create Account
1. Go to [dashboard.plaid.com](https://dashboard.plaid.com)
2. Sign up for a free developer account
3. Complete verification (may take 1-2 days for production)

### Get API Keys
1. Go to **Developers → Keys**
2. Copy to `.env.local`:
   ```
   PLAID_CLIENT_ID=your_client_id
   PLAID_SECRET=your_sandbox_secret
   PLAID_ENV=sandbox
   ```

### Plaid Environments
| Environment | Use Case |
|-------------|----------|
| `sandbox` | Testing with fake bank data |
| `development` | Testing with real banks (100 free items) |
| `production` | Live usage (requires approval) |

### Configure Webhook
1. Go to **Developers → Webhooks**
2. Add webhook URL: `https://your-domain.com/api/webhooks/plaid`

---

## 3. Stripe Setup

### Get API Keys
1. Go to [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
2. Copy to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_live_xxx (or sk_test_xxx for testing)
   ```

### Configure Webhook
1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `payout.created`
   - `payout.updated`
   - `payout.paid`
   - `payout.failed`
5. Copy the signing secret to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

### Test Webhook Locally
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal, trigger test events
stripe trigger payout.paid
```

---

## 4. LemonSqueezy Setup

### Get Webhook Secret
1. Go to [app.lemonsqueezy.com/settings/webhooks](https://app.lemonsqueezy.com/settings/webhooks)
2. Click "Add webhook"
3. URL: `https://your-domain.com/api/webhooks/lemonsqueezy`
4. Select events related to orders and subscriptions
5. Copy signing secret to `.env.local`:
   ```
   LEMONSQUEEZY_WEBHOOK_SECRET=your_secret
   ```

---

## 5. Generate Encryption Key

For securely storing Plaid access tokens:

```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

Add to `.env.local`:
```
ENCRYPTION_KEY=your_generated_key
```

---

## 6. Deploy to Vercel

### Option A: CLI Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# ... repeat for all env vars
```

### Option B: GitHub Integration
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Add all environment variables in project settings
4. Deploy

### Environment Variables for Vercel
Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_APP_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `PLAID_CLIENT_ID` | Yes |
| `PLAID_SECRET` | Yes |
| `PLAID_ENV` | Yes |
| `STRIPE_SECRET_KEY` | If using Stripe |
| `STRIPE_WEBHOOK_SECRET` | If using Stripe |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | If using LS |
| `ENCRYPTION_KEY` | Yes |
| `CRON_SECRET` | Optional |

---

## 7. Post-Deploy Verification

### Test Auth Flow
1. Visit your deployed URL
2. Sign up with a test email
3. Verify you can log in

### Test Project Creation
1. Go to Dashboard → Projects
2. Add a new Stripe project
3. Verify it appears in the list

### Test Plaid Connection
1. Go to Settings
2. Click "Connect Bank"
3. Use Plaid sandbox credentials:
   - Username: `user_good`
   - Password: `pass_good`

### Test Webhooks
1. Use Stripe CLI to trigger a test payout
2. Verify it appears in your dashboard

---

## 8. Cron Job Verification

The reconciliation cron runs every 15 minutes via Vercel Cron.

Check it's working:
1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Verify `/api/cron/reconcile` is listed
3. Check logs after 15 min to see it running

Manual trigger:
```bash
curl -X POST https://your-domain.com/api/cron/reconcile \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Troubleshooting

### "Supabase client error"
- Verify `NEXT_PUBLIC_SUPABASE_URL` starts with `https://`
- Check API keys are correct (no extra spaces)

### Webhooks not arriving
- Verify webhook URL is publicly accessible
- Check webhook signing secret matches
- Look at webhook logs in Stripe/LemonSqueezy dashboard

### Plaid Link not opening
- Check browser console for errors
- Verify `PLAID_CLIENT_ID` and `PLAID_SECRET` are set
- Make sure you're using the correct environment

### Payouts not reconciling
- Check that bank transactions are syncing (Settings page)
- Verify amounts match exactly (in cents)
- Check date range (±3 days by default)

---

## Security Checklist

- [ ] All secrets are in environment variables (not committed)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used server-side
- [ ] Webhook endpoints verify signatures
- [ ] Row Level Security is enabled in Supabase
- [ ] HTTPS is enforced (Vercel does this automatically)

---

## Support

- Supabase Docs: https://supabase.com/docs
- Plaid Docs: https://plaid.com/docs
- Stripe Docs: https://stripe.com/docs
- Next.js Docs: https://nextjs.org/docs
