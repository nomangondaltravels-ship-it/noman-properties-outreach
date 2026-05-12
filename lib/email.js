import nodemailer from 'nodemailer';

export const defaultEmailSubject = 'Property details required - Xsite Real Estate';

export const defaultEmailBody = `Dear {{name}},

You shared your details in the green list for {{serviceCategory}} in {{area}}.

To help you properly, please submit the property details using this secure form:
{{formLink}}

If you want to sell a property, please add location, property type, size, expected price, and availability.

Regards,
Xsite Real Estate`;

function envValue(key, fallback = '') {
  return String(process.env[key] || fallback).trim();
}

export function smtpConfigured() {
  return Boolean(envValue('SMTP_HOST') && envValue('SMTP_USER') && envValue('SMTP_PASS'));
}

export function getTransporter() {
  return nodemailer.createTransport({
    host: envValue('SMTP_HOST'),
    port: Number(envValue('SMTP_PORT', 465)),
    secure: envValue('SMTP_SECURE', 'true') === 'true',
    auth: {
      user: envValue('SMTP_USER'),
      pass: envValue('SMTP_PASS')
    }
  });
}

export function htmlEmail(body) {
  return `
    <div style="font-family:Arial,sans-serif;color:#17201b;line-height:1.55;font-size:15px">
      ${String(body).split('\n').map((line) => `<p style="margin:0 0 12px">${line}</p>`).join('')}
    </div>
  `;
}

export async function sendContactEmail({ transporter, contact, subject, body }) {
  await transporter.sendMail({
    from: `"${envValue('FROM_NAME', 'Xsite Real Estate')}" <${envValue('FROM_EMAIL', envValue('SMTP_USER'))}>`,
    to: contact.email,
    subject,
    text: body,
    html: htmlEmail(body)
  });
}
