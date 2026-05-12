export function publicFormUrl(contact) {
  const base = (process.env.PUBLIC_FORM_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/form/${contact.token}`;
}

function envValue(key, fallback = '') {
  return String(process.env[key] || fallback).trim();
}

function withRequest(formLink, request) {
  const separator = formLink.includes('?') ? '&' : '?';
  return `${formLink}${separator}request=${encodeURIComponent(request)}`;
}

function brokerWhatsAppLink(contact) {
  const number = envValue('BROKER_WHATSAPP_NUMBER').replace(/[^\d]/g, '');
  if (!number) return '';

  const message = [
    `Hello ${envValue('BROKER_NAME', 'Hafiz Muhammad Noman Farman Ali')},`,
    `I received your email regarding my ${contact.service_category || 'property requirement'} in ${contact.area || 'Dubai'}.`,
    'Please contact me.'
  ].join('\n');

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function renderTemplate(text, contact) {
  const formLink = publicFormUrl(contact);
  const brokerEmail = envValue('BROKER_EMAIL', envValue('FROM_EMAIL', 'noman@xsite.ae'));
  const emailSubject = `Property Requirement - ${contact.name || 'Client'}`;

  return String(text || '')
    .replaceAll('{{name}}', contact.name || 'Client')
    .replaceAll('{{area}}', contact.area || 'your selected area')
    .replaceAll('{{propertyType}}', contact.property_type || 'property')
    .replaceAll('{{budget}}', contact.budget || 'not mentioned')
    .replaceAll('{{serviceCategory}}', contact.service_category || 'property requirement')
    .replaceAll('{{formLink}}', formLink)
    .replaceAll('{{callbackLink}}', withRequest(formLink, 'callback'))
    .replaceAll('{{zoomLink}}', withRequest(formLink, 'zoom'))
    .replaceAll('{{whatsappLink}}', brokerWhatsAppLink(contact) || 'WhatsApp number will be shared after reply')
    .replaceAll('{{emailLink}}', `mailto:${brokerEmail}?subject=${encodeURIComponent(emailSubject)}`)
    .replaceAll('{{brokerEmail}}', brokerEmail)
    .replaceAll('{{brokerName}}', envValue('BROKER_NAME', 'Hafiz Muhammad Noman Farman Ali'))
    .replaceAll('{{brokerId}}', envValue('BROKER_ID', '78569'))
    .replaceAll('{{companyName}}', envValue('FROM_NAME', 'Xsite Real Estate'))
    .replaceAll('{{websiteLink}}', envValue('WEBSITE_URL', 'https://www.nomanproperties.com'));
}
