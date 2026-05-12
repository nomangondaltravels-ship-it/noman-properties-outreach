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

const positionalColumns = [
  'name',
  'service_category',
  'property_type',
  'area',
  'budget',
  'email',
  'phone',
  'subscription_end_date'
];

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

function rowArrayToObject(values) {
  return positionalColumns.reduce((row, key, index) => {
    row[key] = values[index] ?? '';
    return row;
  }, {});
}

function rowToContactFromMapped(row) {
  return rowToContact({
    Name: row.name,
    'Service Category': row.service_category,
    'Property Type': row.property_type,
    Area: row.area,
    'Budget (AED)': row.budget,
    Email: row.email,
    Phone: row.phone,
    'Subscription End Date': row.subscription_end_date
  });
}

function nonEmptyCells(row) {
  return row.filter((value) => clean(value)).length;
}

function recognizedHeaderCount(row) {
  return row.filter((value) => headerMap[normalizeHeader(value)]).length;
}

function parseContacts(sheet) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  const firstUsefulIndex = rawRows.findIndex((row) => nonEmptyCells(row) >= 2);
  if (firstUsefulIndex === -1) return [];

  const headerIndex = rawRows.findIndex((row) => recognizedHeaderCount(row) >= 2);
  if (headerIndex !== -1) {
    const headers = rawRows[headerIndex];
    return rawRows
      .slice(headerIndex + 1)
      .map((values) => {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] ?? '';
        });
        return rowToContact(row);
      })
      .filter(Boolean);
  }

  return rawRows
    .slice(firstUsefulIndex)
    .filter((row) => nonEmptyCells(row) >= 2)
    .map((row) => rowToContactFromMapped(rowArrayToObject(row)))
    .filter(Boolean);
}

function contactKey(contact) {
  if (contact.email) return `email:${contact.email}`;
  if (contact.phone) return `phone:${contact.phone}`;
  return `name:${contact.name.toLowerCase()}:${contact.service_category.toLowerCase()}:${contact.area.toLowerCase()}`;
}

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return NextResponse.json({ error: 'File is required.' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const incoming = parseContacts(sheet);

  if (!incoming.length) {
    return NextResponse.json({
      error: 'No contacts found. Please export from Apple Numbers as Excel (.xlsx) or CSV, with columns in this order: Name, Service Category, Property Type, Area, Budget, Email, Phone, Subscription End Date.'
    }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existingContacts, error: existingError } = await supabase.from('contacts').select('*');
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existing = new Map(existingContacts.map((contact) => [contactKey(contact), contact]));
  let added = 0;
  let updated = 0;
  const items = [];

  for (const contact of incoming) {
    const key = contactKey(contact);
    const current = existing.get(key);
    if (current) {
      const { data, error } = await supabase
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
        .eq('id', current.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      existing.set(key, data);
      items.push({ id: data.id, email: data.email, status: data.status, action: 'updated' });
      updated += 1;
    } else {
      const { data, error } = await supabase.from('contacts').insert(contact).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      existing.set(key, data);
      items.push({ id: data.id, email: data.email, status: data.status, action: 'added' });
      added += 1;
    }
  }

  const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
  return NextResponse.json({ added, updated, total: count || 0, items });
}
