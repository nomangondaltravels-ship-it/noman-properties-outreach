import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function idFromRequest(request, params) {
  if (params?.id) return params.id;
  const path = new URL(request.url).pathname;
  return decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
}

async function requestPayload(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function cleanPhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

async function findContact(supabase, { id, email, phone }) {
  if (id) {
    const { data, error } = await supabase.from('contacts').select('id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', String(email).trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  if (phone) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', cleanPhone(phone))
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
}

export async function DELETE(request, { params }) {
  const payload = await requestPayload(request);
  const id = payload.id || idFromRequest(request, params);
  const email = payload.email || '';
  const phone = payload.phone || '';
  if (!id && !email && !phone) {
    return NextResponse.json({ error: 'Contact id, email, or phone is required.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let existing = null;
  try {
    existing = await findContact(supabase, { id, email, phone });
  } catch (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!existing?.id) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: existing.id });
}
