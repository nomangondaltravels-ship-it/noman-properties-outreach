import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(_request, { params }) {
  const supabase = getSupabaseAdmin();
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id,name,service_category,property_type,area,email,phone')
    .eq('token', params.token)
    .single();

  if (error || !contact) return NextResponse.json({ error: 'Form link not found.' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function POST(request, { params }) {
  const payload = await request.json();
  const supabase = getSupabaseAdmin();

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('token', params.token)
    .single();

  if (error || !contact) return NextResponse.json({ error: 'Form link not found.' }, { status: 404 });

  const { error: responseError } = await supabase.from('responses').insert({
    contact_id: contact.id,
    requirement: payload.requirement || '',
    property_type: payload.property_type || '',
    area: payload.area || '',
    building: payload.building || '',
    bedrooms: payload.bedrooms || '',
    size: payload.size || '',
    price: payload.price || '',
    availability: payload.availability || '',
    name: payload.name || '',
    phone: payload.phone || '',
    email: payload.email || '',
    preferred_contact: payload.preferred_contact || '',
    notes: payload.notes || ''
  });

  if (responseError) return NextResponse.json({ error: responseError.message }, { status: 500 });

  await supabase
    .from('contacts')
    .update({ status: 'responded', updated_at: new Date().toISOString() })
    .eq('id', contact.id);

  return NextResponse.json({ ok: true });
}
