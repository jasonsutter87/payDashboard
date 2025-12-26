import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  processor: z.enum(['stripe', 'lemonsqueezy', 'strike']),
  processor_account_id: z.string().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = createProjectSchema.parse(body);

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: validated.name,
        processor: validated.processor,
        processor_account_id: validated.processor_account_id || null,
        webhook_secret: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
