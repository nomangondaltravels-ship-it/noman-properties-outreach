import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { businessEmailBlocked } from '@/lib/compliance';

export const runtime = 'nodejs';

const headerMap = {
  name: 'name',
  servicecategory: 'service_category',
  category: 'service_category',
  propertytype: 'property_type',
  area: 'area',
  budgetaed: 'budget',
  budget: 'budget',
  email: 'email',
  phone: 'phone',
  mobilenumber: 'phone',
  number: 'phone',
  subscriptionenddate: 'subscription_end_date'
};

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function rowToContact(row) {
  const contact = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = headerMap[normalizeHeader(key)];
    if (mapped) contact[mapped] = clean(value);
  }

  if (!contact.name && !contact.email && !contact.phone) return null;

  return {
    token: crypto.randomBytes(18).toString('hex'),
    name: clean(contact.name),
    service_category: clean(contact.service_category),
    property_type: clean(contact.property_type),
    area: clean(contact.area),
    budget: clean(contact.budget),
    email: clean(contact.email).toLowerCase(),
    phone: clean(contact.phone).replace(/[^\d+]/g, ''),
    subscription_end_date: clean(contact.subscription_end_date),
    status: businessEmailBlocked(contact.email) ? 'blocked_business' : 'ready'
  };
}

function contactKey(contact) {
  if (contact.email) return `email:${contact.email}`;
  if (contact.phone) return `phone:${contact.phone}`;
  return `name:${contact.name.toLowerCase()}`;
}

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return NextResponse.json({ error: 'File is required.' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const incoming = rows.map(rowToContact).filter(Boolean);

  const supabase = getSupabaseAdmin();
  const { data: existingContacts, error: existingError } = await supabase.from('contacts').select('*');
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existing = new Map(existingContacts.map((contact) => [contactKey(contact), contact]));
  let added = 0;
  let updated = 0;

  for (const contact of incoming) {
    const key = contactKey(contact);
    const current = existing.get(key);
    if (current) {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: contact.name,
          service_category: contact.service_category,
          property_type: contact.property_type,
          area: contact.area,
          budget: contact.budget,
          email: contact.email,
          phone: contact.phone,
          subscription_end_date: contact.subscription_end_date,
          status: ['responded', 'do_not_contact'].includes(current.status) ? current.status : contact.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      updated += 1;
    } else {
      const { data, error } = await supabase.from('contacts').insert(contact).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      existing.set(key, data);
      added += 1;
    }
  }

  const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
  return NextResponse.json({ added, updated, total: count || 0 });
}
