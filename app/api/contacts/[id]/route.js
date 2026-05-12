import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function DELETE(_request, { params }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', params.id)
    .select('id')
    .single();

  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.id) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });

  return NextResponse.json({ ok: true, id: data.id });
}
