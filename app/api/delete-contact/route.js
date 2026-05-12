import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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

function matchingContacts(contacts, { id, email, phone }) {
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

export async function POST(request) {
  const payload = await readPayload(request);
  const id = String(payload.id || '').trim();
  const email = payload.email || '';
  const phone = payload.phone || '';

  if (!id && !email && !phone) {
    return NextResponse.json({ error: 'Contact id, email, or phone is required.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contacts, error: contactsError } = await supabase.from('contacts').select('id,email,phone');
  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 });

  let matches = matchingContacts(contacts || [], { id, email, phone });
  if (!matches.length) {
    const url = new URL('/api/contacts', request.url);
    url.searchParams.set('t', String(Date.now()));
    const contactResponse = await fetch(url, { cache: 'no-store' });
    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      matches = matchingContacts(contactData.contacts || [], { id, email, phone });
    }
  }

  if (!matches.length) {
    return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  }

  const ids = matches.map((contact) => contact.id);
  const { error: responseError } = await supabase.from('responses').delete().in('contact_id', ids);
  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 });

  const { error: deleteError } = await supabase.from('contacts').delete().in('id', ids);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: ids.length, ids });
}
