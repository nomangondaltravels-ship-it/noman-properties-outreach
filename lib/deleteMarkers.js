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

function markerContactId(item) {
  return String(item?.id || item?.contact_id || '').trim();
}

function withoutMarkerIds(items, idSet) {
  return (Array.isArray(items) ? items : []).filter((item) => !idSet.has(markerContactId(item)));
}

function parseCampaignBody(value) {
  try {
    const body = JSON.parse(value || '{}');
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

export async function removeDeleteMarkers(supabase, ids = []) {
  const idList = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!idList.length) return { responseMarkersRemoved: 0, campaignMarkersRemoved: 0, campaignMarkersUpdated: 0 };

  const idSet = new Set(idList);
  const { data: responseRows, error: responseError } = await supabase
    .from('responses')
    .delete()
    .in('contact_id', idList)
    .eq('requirement', DELETE_MARKER_REQUIREMENT)
    .select('contact_id');
  if (responseError) throw responseError;

  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id,body,results,count')
    .eq('subject', DELETE_MARKER_SUBJECT);
  if (campaignsError) throw campaignsError;

  let campaignMarkersRemoved = 0;
  let campaignMarkersUpdated = 0;

  for (const campaign of campaigns || []) {
    const body = parseCampaignBody(campaign.body);
    const currentContacts = Array.isArray(body.contacts) ? body.contacts : [];
    const currentResults = Array.isArray(campaign.results) ? campaign.results : [];
    const nextContacts = withoutMarkerIds(currentContacts, idSet);
    const nextResults = withoutMarkerIds(currentResults, idSet);

    if (nextContacts.length === currentContacts.length && nextResults.length === currentResults.length) continue;

    const remainingCount = Math.max(nextContacts.length, nextResults.length);
    if (!remainingCount) {
      const { error: deleteCampaignError } = await supabase.from('campaigns').delete().eq('id', campaign.id);
      if (deleteCampaignError) throw deleteCampaignError;
      campaignMarkersRemoved += 1;
      continue;
    }

    const nextBody = {
      ...body,
      contacts: nextContacts.length ? nextContacts : nextResults
    };
    const { error: updateCampaignError } = await supabase
      .from('campaigns')
      .update({
        body: JSON.stringify(nextBody),
        results: nextResults,
        count: remainingCount
      })
      .eq('id', campaign.id);
    if (updateCampaignError) throw updateCampaignError;
    campaignMarkersUpdated += 1;
  }

  return {
    responseMarkersRemoved: (responseRows || []).length,
    campaignMarkersRemoved,
    campaignMarkersUpdated
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
