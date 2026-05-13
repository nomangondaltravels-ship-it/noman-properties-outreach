import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

async function findContacts(supabase, { id, email, phone }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = cleanPhone(phone);
  const { data, error } = await supabase.from('contacts').select('id,email,phone');
  if (error) throw error;

  const contacts = data || [];
  const exactId = contacts.find((contact) => contact.id === id);
  if (exactId) return [exactId];

  if (normalizedEmail) {
    const emailMatches = contacts.filter((contact) => String(contact.email || '').trim().toLowerCase() === normalizedEmail);
    if (emailMatches.length) return emailMatches;
  }

  if (normalizedPhone) {
    return contacts.filter((contact) => cleanPhone(contact.phone) === normalizedPhone);
  }

  return [];
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
  let existing = [];
  try {
    existing = await findContacts(supabase, { id, email, phone });
  } catch (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!existing.length) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });

  const deleteIds = existing.map((contact) => contact.id);
  const { data: archived, error } = await supabase
    .from('contacts')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .in('id', deleteIds)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const archivedIds = new Set((archived || []).map((contact) => contact.id));
  const missingIds = deleteIds.filter((contactId) => !archivedIds.has(contactId));
  if (missingIds.length) {
    const { data: removed, error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .in('id', missingIds)
      .select('id');
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    const removedIds = new Set((removed || []).map((contact) => contact.id));
    const failedIds = missingIds.filter((contactId) => !removedIds.has(contactId));
    if (failedIds.length) {
      return NextResponse.json(
        { error: 'Delete did not change database rows. Please check SUPABASE_SERVICE_ROLE_KEY in Vercel.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, deleted: existing.length, ids: deleteIds });
}
