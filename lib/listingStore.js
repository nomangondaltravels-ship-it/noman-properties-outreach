export const PROPERTY_LISTING_SUBJECT = '__property_listing__';
export const PROPERTY_LISTING_DELETE_SUBJECT = '__property_listing_deleted__';

function clean(value) {
  return String(value || '').trim();
}

const PUBLIC_AVAILABLE_STATUSES = new Set(['', 'available', 'active', 'live', 'ready']);
const PUBLIC_UNAVAILABLE_AVAILABILITY_TERMS = [
  'not available',
  'unavailable',
  'sold',
  'rented out',
  'closed',
  'off market',
  'off-market',
  'withdrawn',
  'draft'
];

function normalizeListingType(value) {
  return clean(value).toLowerCase() === 'rent' ? 'rent' : 'sale';
}

export function normalizeListingPayload(payload = {}) {
  const title = clean(payload.title);
  if (!title) {
    throw new Error('Property title is required.');
  }

  return {
    listing_type: normalizeListingType(payload.listing_type || payload.listingType),
    title,
    property_type: clean(payload.property_type || payload.propertyType) || 'Apartment',
    area: clean(payload.area) || 'Dubai',
    building: clean(payload.building),
    bedrooms: clean(payload.bedrooms),
    bathrooms: clean(payload.bathrooms),
    size: clean(payload.size),
    price: clean(payload.price),
    availability: clean(payload.availability) || 'Available',
    status: clean(payload.status) || 'available',
    permit_number: clean(payload.permit_number || payload.permitNumber),
    nexbridge_url: clean(payload.nexbridge_url || payload.nexbridgeUrl),
    nexbridge_ref: clean(payload.nexbridge_ref || payload.nexbridgeRef),
    photos: clean(payload.photos),
    notes: clean(payload.notes),
    created_at: clean(payload.created_at) || new Date().toISOString()
  };
}

export function isPublicAvailableListing(listing = {}) {
  const status = clean(listing.status).toLowerCase().replace(/\s+/g, '_');
  if (!PUBLIC_AVAILABLE_STATUSES.has(status)) return false;

  const availability = clean(listing.availability).toLowerCase();
  return !PUBLIC_UNAVAILABLE_AVAILABILITY_TERMS.some((term) => availability.includes(term));
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseListing(row) {
  const fromResults = Array.isArray(row.results) && row.results[0] ? row.results[0] : null;
  const fromBody = parseJson(row.body, {});
  const data = fromResults?.title ? fromResults : fromBody;
  if (!data?.title) return null;

  return {
    id: row.id,
    ...data,
    listing_type: normalizeListingType(data.listing_type || data.listingType),
    created_at: data.created_at || row.sent_at
  };
}

function deletedListingIds(rows = []) {
  return new Set(
    rows
      .map((row) => {
        const fromResults = Array.isArray(row.results) && row.results[0] ? row.results[0] : null;
        const fromBody = parseJson(row.body, {});
        return clean(fromResults?.listing_id || fromResults?.id || fromBody.listing_id || fromBody.id);
      })
      .filter(Boolean)
  );
}

export function rowsToListings(rows = [], deletedRows = []) {
  const deletedIds = deletedListingIds(deletedRows);
  return rows
    .map(parseListing)
    .filter(Boolean)
    .filter((listing) => !deletedIds.has(listing.id))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

export async function saveListing(supabase, listing) {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      subject: PROPERTY_LISTING_SUBJECT,
      body: JSON.stringify(listing),
      dry_run: true,
      count: 1,
      results: [listing]
    })
    .select('id, subject, body, dry_run, count, results, sent_at')
    .single();

  if (error) throw error;
  return parseListing(data);
}

export async function deleteListing(supabase, id) {
  const listingId = clean(id);
  if (!listingId) {
    throw new Error('Listing id is required.');
  }

  const { data, error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', listingId)
    .select('id');

  if (!error && data?.length) {
    return { id: listingId, mode: 'deleted' };
  }

  const marker = {
    listing_id: listingId,
    deleted_at: new Date().toISOString()
  };

  const { error: markerError } = await supabase
    .from('campaigns')
    .insert({
      subject: PROPERTY_LISTING_DELETE_SUBJECT,
      body: JSON.stringify(marker),
      dry_run: true,
      count: 0,
      results: [marker]
    });

  if (markerError) throw markerError;
  return { id: listingId, mode: 'marked' };
}
