import nodemailer from 'nodemailer';

export const defaultEmailSubject = 'Property details required - Noman Properties';

export const defaultEmailBody = `Dear {{name}},

You shared your details in the green list for {{serviceCategory}} in {{area}}.

To help you properly, please submit the property details using this secure form:
{{formLink}}

If you want to sell a property, please add location, property type, size, expected price, and availability.

Regards,
Noman Properties`;

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
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
    from: `"${process.env.FROM_NAME || 'Noman Properties'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
    to: contact.email,
    subject,
    text: body,
    html: htmlEmail(body)
  });
}
