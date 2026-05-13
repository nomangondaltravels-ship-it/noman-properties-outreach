import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { addDeleteMarkers } from '@/lib/deleteMarkers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cleanPhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function readPayload(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function matchingContacts(contacts, { id, ids = [], email, phone }) {
  const idSet = new Set(ids.map((value) => String(value || '').trim()).filter(Boolean));
  if (idSet.size) return contacts.filter((contact) => idSet.has(contact.id));

  const exactId = contacts.find((contact) => contact.id === id);
  if (exactId) return [exactId];

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const emailMatches = contacts.filter((contact) => normalizeEmail(contact.email) === normalizedEmail);
    if (emailMatches.length) return emailMatches;
  }

  const normalizedPhone = cleanPhone(phone);
  if (normalizedPhone) {
    return contacts.filter((contact) => cleanPhone(contact.phone) === normalizedPhone);
  }

  return [];
}

async function visibleMatches(request, identifiers) {
  const url = new URL('/api/contacts', request.url);
  url.searchParams.set('t', String(Date.now()));
  const contactResponse = await fetch(url, { cache: 'no-store' });
  if (!contactResponse.ok) return [];
  const contactData = await contactResponse.json();
  return matchingContacts(contactData.contacts || [], identifiers);
}

async function archiveContacts(supabase, contacts) {
  const deleteIds = contacts.map((contact) => contact.id);
  const timestamp = new Date().toISOString();
  const { data: archived, error: archiveError } = await supabase
    .from('contacts')
    .update({ status: 'deleted', updated_at: timestamp })
    .in('id', deleteIds)
    .select('id');
  if (archiveError) throw archiveError;

  const archivedIds = new Set((archived || []).map((contact) => contact.id));
  const missingIds = deleteIds.filter((id) => !archivedIds.has(id));
  if (!missingIds.length) return { deletedIds: deleteIds, mode: 'archived' };

  const { data: removed, error: deleteError } = await supabase
    .from('contacts')
    .delete()
    .in('id', missingIds)
    .select('id');
  if (deleteError) throw deleteError;

  const removedIds = new Set((removed || []).map((contact) => contact.id));
  const failedIds = missingIds.filter((id) => !removedIds.has(id));
  if (failedIds.length) {
    const markerContacts = contacts.filter((contact) => failedIds.includes(contact.id));
    const markedIds = await addDeleteMarkers(supabase, markerContacts);
    const stillFailedIds = failedIds.filter((id) => !markedIds.includes(id));
    if (stillFailedIds.length) {
      throw new Error('Delete did not change database rows. Please check SUPABASE_SERVICE_ROLE_KEY in Vercel.');
    }

    return {
      deletedIds: [...archivedIds, ...removedIds, ...markedIds],
      mode: archivedIds.size || removedIds.size ? 'archived-deleted-and-marked' : 'marked'
    };
  }

  return { deletedIds: [...archivedIds, ...removedIds], mode: archivedIds.size ? 'archived-and-deleted' : 'deleted' };
}

export async function POST(request) {
  const payload = await readPayload(request);
  const id = String(payload.id || '').trim();
  const ids = Array.isArray(payload.ids) ? payload.ids.map((value) => String(value || '').trim()).filter(Boolean) : [];
  const email = payload.email || '';
  const phone = payload.phone || '';

  if (!id && !ids.length && !email && !phone) {
    return NextResponse.json({ error: 'Contact id, email, or phone is required.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contacts, error: contactsError } = await supabase.from('contacts').select('id,name,email,phone');
  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 });

  let matches = matchingContacts(contacts || [], { id, ids, email, phone });
  if (!matches.length) matches = await visibleMatches(request, { id, ids, email, phone });

  if (!matches.length) {
    return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  }

  const deleteIds = matches.map((contact) => contact.id);
  await supabase.from('responses').delete().in('contact_id', deleteIds);

  let result;
  try {
    result = await archiveContacts(supabase, matches);
  } catch (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: result.deletedIds.length, ids: result.deletedIds, mode: result.mode });
}
