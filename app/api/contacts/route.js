import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [{ data: contacts, error: contactsError }, { data: responses, error: responsesError }] = await Promise.all([
    supabase.from('contacts').select('*').neq('status', 'deleted').order('created_at', { ascending: false }),
    supabase.from('responses').select('*').order('submitted_at', { ascending: false })
  ]);

  if (contactsError || responsesError) {
    return NextResponse.json({ error: contactsError?.message || responsesError?.message }, { status: 500 });
  }

  return NextResponse.json({ contacts, responses });
}
