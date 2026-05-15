export const DELETE_MARKER_REQUIREMENT = '__deleted_contact__';
export const DELETE_MARKER_SUBJECT = '__deleted_contacts__';

export function isDeleteMarker(response) {
  return response?.requirement === DELETE_MARKER_REQUIREMENT;
}

function campaignMarkerIds(campaigns = []) {
  const ids = new Set();

  campaigns
    .filter((campaign) => campaign?.subject === DELETE_MARKER_SUBJECT)
    .forEach((campaign) => {
      const results = Array.isArray(campaign.results) ? campaign.results : [];
      results.forEach((item) => {
        if (item?.id) ids.add(item.id);
        if (item?.contact_id) ids.add(item.contact_id);
      });

      try {
        const body = JSON.parse(campaign.body || '{}');
        const contacts = Array.isArray(body.contacts) ? body.contacts : [];
        contacts.forEach((contact) => {
          if (contact?.id) ids.add(contact.id);
          if (contact?.contact_id) ids.add(contact.contact_id);
        });
      } catch {
        // Ignore older campaign rows with non-JSON email body text.
      }
    });

  return ids;
}

export function filterDeletedRecords(contacts = [], responses = [], campaigns = []) {
  const deletedIds = new Set(
    responses
      .filter(isDeleteMarker)
      .map((response) => response.contact_id)
      .filter(Boolean)
  );
  campaignMarkerIds(campaigns).forEach((id) => deletedIds.add(id));

  return {
    contacts: contacts.filter((contact) => contact.status !== 'deleted' && !deletedIds.has(contact.id)),
    responses: responses.filter((response) => !isDeleteMarker(response) && !deletedIds.has(response.contact_id)),
    deletedIds
  };
}

export async function addDeleteMarkers(supabase, contacts = []) {
  const uniqueContacts = new Map();
  contacts.forEach((contact) => {
    if (contact?.id) uniqueContacts.set(contact.id, contact);
  });

  const timestamp = new Date().toISOString();
  const markerContacts = [...uniqueContacts.values()];
  const rows = markerContacts.map((contact) => ({
    contact_id: contact.id,
    requirement: DELETE_MARKER_REQUIREMENT,
    name: contact.name || '',
    phone: contact.phone || '',
    email: contact.email || '',
    notes: JSON.stringify({
      deleted_at: timestamp,
      contact_id: contact.id,
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || ''
    })
  }));

  if (!rows.length) return [];

  const campaignResults = markerContacts.map((contact) => ({
    id: contact.id,
    email: contact.email || '',
    phone: contact.phone || '',
    status: 'deleted'
  }));

  const { data, error } = await supabase.from('responses').insert(rows).select('contact_id');

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      subject: DELETE_MARKER_SUBJECT,
      body: JSON.stringify({ deleted_at: timestamp, contacts: campaignResults }),
      dry_run: true,
      count: campaignResults.length,
      results: campaignResults
    })
    .select('results')
    .single();

  const responseIds = !error ? (data || []).map((row) => row.contact_id).filter(Boolean) : [];
  const campaignIds = !campaignError ? (campaign?.results || []).map((row) => row.id).filter(Boolean) : [];
  const markedIds = [...new Set([...responseIds, ...campaignIds])];

  if (!markedIds.length) {
    const responseMessage = error?.message || 'response marker did not save';
    const campaignMessage = campaignError?.message || 'campaign marker did not save';
    throw new Error(`${responseMessage}; marker fallback failed: ${campaignMessage}`);
  }

  return markedIds;
}
