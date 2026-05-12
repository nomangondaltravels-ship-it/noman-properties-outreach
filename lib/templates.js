export function publicFormUrl(contact) {
  const base = (process.env.PUBLIC_FORM_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/form/${contact.token}`;
}

export function renderTemplate(text, contact) {
  return String(text || '')
    .replaceAll('{{name}}', contact.name || 'Client')
    .replaceAll('{{area}}', contact.area || 'your selected area')
    .replaceAll('{{propertyType}}', contact.property_type || 'property')
    .replaceAll('{{serviceCategory}}', contact.service_category || 'property requirement')
    .replaceAll('{{formLink}}', publicFormUrl(contact));
}
