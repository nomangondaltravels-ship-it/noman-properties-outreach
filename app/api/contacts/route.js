import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DELETE_MARKER_SUBJECT, filterDeletedRecords } from '@/lib/deleteMarkers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [
    { data: contacts, error: contactsError },
    { data: responses, error: responsesError },
    { data: deleteCampaigns }
  ] = await Promise.all([
    supabase.from('contacts').select('*').order('created_at', { ascending: false }),
    supabase.from('responses').select('*').order('submitted_at', { ascending: false }),
    supabase.from('campaigns').select('subject,body,results').eq('subject', DELETE_MARKER_SUBJECT)
  ]);

  if (contactsError || responsesError) {
    return NextResponse.json({ error: contactsError?.message || responsesError?.message }, { status: 500 });
  }

  const filtered = filterDeletedRecords(contacts || [], responses || [], deleteCampaigns || []);

  return NextResponse.json({ contacts: filtered.contacts, responses: filtered.responses });
}
