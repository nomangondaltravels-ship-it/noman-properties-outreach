import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function idFromRequest(request, params) {
  if (params?.id) return params.id;
  const path = new URL(request.url).pathname;
  return decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
}

export async function DELETE(request, { params }) {
  const id = idFromRequest(request, params);
  if (!id) return NextResponse.json({ error: 'Contact id is required.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!existing?.id) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id });
}
