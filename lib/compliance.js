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

  if (contact.last_emailed_at) {
    const last = new Date(contact.last_emailed_at).getTime();
    const gapMs = MIN_EMAIL_GAP_DAYS * 86400000;
    if (!Number.isNaN(last) && now.getTime() - last < gapMs) {
      const nextDate = new Date(last + gapMs).toISOString().slice(0, 10);
      return { ok: false, reason: `Wait until ${nextDate}` };
    }
  }

  return { ok: true, reason: 'Eligible' };
}

export const categoryTemplates = {
  sell: {
    label: 'Sell Property',
    subject: 'Seller property details required - Xsite Real Estate',
    body: `Dear {{name}},

You shared your details in the green list for selling property in {{area}}.

To help you properly, please submit your property details using this secure form:
{{formLink}}

Please add location, property type, size, expected selling price, and availability.

Regards,
Xsite Real Estate`
  },
  lease: {
    label: 'Lease Property',
    subject: 'Leasing property details required - Xsite Real Estate',
    body: `Dear {{name}},

You shared your details in the green list for leasing property in {{area}}.

To help you properly, please submit your property details using this secure form:
{{formLink}}

Please add location, property type, size, expected rent, payment terms, and availability.

Regards,
Xsite Real Estate`
  },
  buy: {
    label: 'Buy Property',
    subject: 'Buyer requirement details required - Xsite Real Estate',
    body: `Dear {{name}},

You shared your details in the green list for buying property in {{area}}.

To help you properly, please submit your buying requirement using this secure form:
{{formLink}}

Please add preferred location, property type, size, budget, timeline, and payment plan preference.

Regards,
Xsite Real Estate`
  },
  all: {
    label: 'All Services',
    subject: 'Property details required - Xsite Real Estate',
    body: `Dear {{name}},

You shared your details in the green list for {{serviceCategory}} in {{area}}.

To help you properly, please submit the property details using this secure form:
{{formLink}}

Please add location, property type, size, expected price or rent, and availability.

Regards,
Xsite Real Estate`
  }
};

export function templateForContact(contact) {
  return categoryTemplates[normalizeCategory(contact?.service_category)] || categoryTemplates.all;
}
