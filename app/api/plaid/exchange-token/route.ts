import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { plaidClient } from '@/lib/plaid/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { public_token, metadata } = await request.json();

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution info
    const institution = metadata?.institution;
    const account = metadata?.accounts?.[0];

    // Store the connection using admin client (to bypass RLS for insert)
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from('bank_connections').insert({
      user_id: user.id,
      plaid_item_id: itemId,
      plaid_access_token: accessToken, // TODO: Encrypt this
      institution_name: institution?.name || null,
      account_mask: account?.mask || null,
    });

    if (error) {
      console.error('Error storing bank connection:', error);
      return NextResponse.json(
        { error: 'Failed to store bank connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
