import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { businessEmailBlocked } from '@/lib/compliance';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function cleanPhone(value) {
  return clean(value).replace(/[^\d+]/g, '');
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizeContact(payload) {
  const name = clean(payload.name);
  const email = normalizeEmail(payload.email);
  const phone = cleanPhone(payload.phone);

  if (!name) throw new Error('Name is required.');
  if (!email && !phone) throw new Error('Please add email or phone.');

  return {
    token: crypto.randomBytes(18).toString('hex'),
    name,
    service_category: clean(payload.service_category) || 'All Services',
    property_type: clean(payload.property_type) || 'All property types',
    area: clean(payload.area) || 'All areas',
    budget: clean(payload.budget) || 'N/A',
    email,
    phone,
    subscription_end_date: clean(payload.subscription_end_date),
    status: businessEmailBlocked(email) ? 'blocked_business' : 'ready'
  };
}

function findExisting(contacts, incoming) {
  if (incoming.email) {
    const emailMatch = contacts.find((contact) => normalizeEmail(contact.email) === incoming.email);
    if (emailMatch) return emailMatch;
  }

  if (incoming.phone) {
    return contacts.find((contact) => cleanPhone(contact.phone) === incoming.phone);
  }

  return null;
}

export async function POST(request) {
  let incoming;
  try {
    incoming = normalizeContact(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Invalid contact details.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contacts, error: contactsError } = await supabase.from('contacts').select('*');
  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 });

  const current = findExisting(contacts || [], incoming);
  let saved;
  let action;

  if (current) {
    const { data, error } = await supabase
      .from('contacts')
      .update({
        name: incoming.name,
        service_category: incoming.service_category,
        property_type: incoming.property_type,
        area: incoming.area,
        budget: incoming.budget,
        email: incoming.email,
        phone: incoming.phone,
        subscription_end_date: incoming.subscription_end_date,
        status: ['responded', 'do_not_contact'].includes(current.status) ? current.status : incoming.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', current.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data;
    action = 'updated';
  } else {
    const { data, error } = await supabase.from('contacts').insert(incoming).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data;
    action = 'added';
  }

  const { count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'deleted');

  return NextResponse.json({ action, contact: saved, total: count || 0 });
}
