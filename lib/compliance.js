const BLOCKED_BUSINESS_TERMS = [
  'realestate',
  'real-estate',
  'real_estate',
  'property',
  'properties',
  'broker',
  'brokers',
  'estateagency',
  'agency'
];

const ALLOWED_OWN_DOMAINS = ['xsite.ae'];

export const MIN_EMAIL_GAP_DAYS = 15;

export function normalizeCategory(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (normalized.includes('sell')) return 'sell';
  if (normalized.includes('lease') || normalized.includes('rent')) return 'lease';
  if (normalized.includes('buy') || normalized.includes('purchase')) return 'buy';
  return 'all';
}

export function businessEmailBlocked(email = '') {
  const normalized = String(email).trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;

  const [, domain = ''] = normalized.split('@');
  if (ALLOWED_OWN_DOMAINS.includes(domain)) return false;

  const compact = normalized.replace(/[^a-z0-9@.]/g, '');
  return BLOCKED_BUSINESS_TERMS.some((term) => compact.includes(term.replace(/[^a-z0-9]/g, '')));
}

export function daysSince(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / 86400000);
}

export function canEmailContact(contact, now = new Date()) {
  if (!contact?.email) return { ok: false, reason: 'No email' };
  if (businessEmailBlocked(contact.email)) return { ok: false, reason: 'Business/real-estate email blocked' };
  if (['responded', 'do_not_contact', 'blocked_business', 'deleted'].includes(contact.status)) {
    return { ok: false, reason: `Status is ${contact.status}` };
  }

  return { ok: true, reason: 'Eligible' };
}

export const categoryTemplates = {
  sell: {
    label: 'Sell Property',
    subject: 'Seller requirement confirmation - Xsite Real Estate',
    body: `Dear {{name}},

I hope you are doing well.

Your name is listed in the Dubai Land Department / Dubai Brokers Green List with this requirement:
Service: {{serviceCategory}}
Property Type: {{propertyType}}
Area: {{area}}

To assist you professionally with selling your property, please submit the basic details using this secure form:
{{formLink}}

You can also request a call back here:
{{callbackLink}}

For a Zoom meeting request:
{{zoomLink}}

WhatsApp:
{{whatsappLink}}

Email:
{{brokerEmail}}

Broker Details:
{{brokerName}}
Property Consultant
{{companyName}}
Dubai Broker Card No: {{brokerId}}
RERA/DLD verified broker
Website: {{websiteLink}}

If you are not interested or do not wish to be contacted, please reply STOP and I will stop communication immediately.

Regards,
{{brokerName}}`
  },
  lease: {
    label: 'Lease Property',
    subject: 'Leasing requirement confirmation - Xsite Real Estate',
    body: `Dear {{name}},

I hope you are doing well.

Your name is listed in the Dubai Land Department / Dubai Brokers Green List with this requirement:
Service: {{serviceCategory}}
Property Type: {{propertyType}}
Area: {{area}}

To assist you professionally with leasing your property, please submit the basic details using this secure form:
{{formLink}}

You can also request a call back here:
{{callbackLink}}

For a Zoom meeting request:
{{zoomLink}}

WhatsApp:
{{whatsappLink}}

Email:
{{brokerEmail}}

Broker Details:
{{brokerName}}
Property Consultant
{{companyName}}
Dubai Broker Card No: {{brokerId}}
RERA/DLD verified broker
Website: {{websiteLink}}

If you are not interested or do not wish to be contacted, please reply STOP and I will stop communication immediately.

Regards,
{{brokerName}}`
  },
  buy: {
    label: 'Buy Property',
    subject: 'Buyer requirement confirmation - Xsite Real Estate',
    body: `Dear {{name}},

I hope you are doing well.

Your name is listed in the Dubai Land Department / Dubai Brokers Green List with this requirement:
Service: {{serviceCategory}}
Property Type: {{propertyType}}
Area: {{area}}
Budget: {{budget}}

To assist you professionally with matching suitable properties, please confirm your buying requirement using this secure form:
{{formLink}}

You can also request a call back here:
{{callbackLink}}

For a Zoom meeting request:
{{zoomLink}}

WhatsApp:
{{whatsappLink}}

Email:
{{brokerEmail}}

Broker Details:
{{brokerName}}
Property Consultant
{{companyName}}
Dubai Broker Card No: {{brokerId}}
RERA/DLD verified broker
Website: {{websiteLink}}

If you are not interested or do not wish to be contacted, please reply STOP and I will stop communication immediately.

Regards,
{{brokerName}}`
  },
  all: {
    label: 'All Services',
    subject: 'Property requirement confirmation - Xsite Real Estate',
    body: `Dear {{name}},

I hope you are doing well.

Your name is listed in the Dubai Land Department / Dubai Brokers Green List with this requirement:
Service: {{serviceCategory}}
Property Type: {{propertyType}}
Area: {{area}}
Budget: {{budget}}

To assist you professionally, please submit the basic property details using this secure form:
{{formLink}}

You can also request a call back here:
{{callbackLink}}

For a Zoom meeting request:
{{zoomLink}}

WhatsApp:
{{whatsappLink}}

Email:
{{brokerEmail}}

Broker Details:
{{brokerName}}
Property Consultant
{{companyName}}
Dubai Broker Card No: {{brokerId}}
RERA/DLD verified broker
Website: {{websiteLink}}

If you are not interested or do not wish to be contacted, please reply STOP and I will stop communication immediately.

Regards,
{{brokerName}}`
  }
};

export function templateForContact(contact) {
  return categoryTemplates[normalizeCategory(contact?.service_category)] || categoryTemplates.all;
}
