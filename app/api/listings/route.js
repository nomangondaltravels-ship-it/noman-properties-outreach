import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  PROPERTY_LISTING_DELETE_SUBJECT,
  PROPERTY_LISTING_SUBJECT,
  deleteListing,
  isPublicAvailableListing,
  normalizeListingPayload,
  rowsToListings,
  saveListing
} from '@/lib/listingStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const supabase = getSupabaseAdmin();
  const type = request.nextUrl.searchParams.get('type') || 'all';
  const availableOnly = ['1', 'true', 'yes'].includes(
    String(request.nextUrl.searchParams.get('available') || '').toLowerCase()
  );

  const [listingResult, deletedResult] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, subject, body, dry_run, count, results, sent_at')
      .eq('subject', PROPERTY_LISTING_SUBJECT)
      .order('sent_at', { ascending: false }),
    supabase
      .from('campaigns')
      .select('id, subject, body, dry_run, count, results, sent_at')
      .eq('subject', PROPERTY_LISTING_DELETE_SUBJECT)
  ]);

  if (listingResult.error) {
    return NextResponse.json({ error: listingResult.error.message }, { status: 500 });
  }

  if (deletedResult.error) {
    return NextResponse.json({ error: deletedResult.error.message }, { status: 500 });
  }

  let listings = rowsToListings(listingResult.data || [], deletedResult.data || []);
  if (availableOnly) {
    listings = listings.filter(isPublicAvailableListing);
  }
  if (type === 'sale' || type === 'rent') {
    listings = listings.filter((listing) => listing.listing_type === type);
  }

  return NextResponse.json({ listings });
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  let listing;

  try {
    listing = normalizeListingPayload(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Invalid listing details.' }, { status: 400 });
  }

  try {
    const saved = await saveListing(supabase, listing);
    return NextResponse.json({ listing: saved });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to save listing.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const supabase = getSupabaseAdmin();
  const body = await request.json().catch(() => ({}));
  const id = request.nextUrl.searchParams.get('id') || body.id;

  try {
    const result = await deleteListing(supabase, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to delete listing.' }, { status: 500 });
  }
}
