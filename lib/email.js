import nodemailer from 'nodemailer';
import { categoryTemplates } from './compliance';
import { publicFormUrl } from './templates';

export const defaultEmailSubject = categoryTemplates.all.subject;
export const defaultEmailBody = categoryTemplates.all.body;

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

function publicAssetUrl(path) {
  const base = envValue('PUBLIC_FORM_BASE_URL', 'https://noman-properties-outreach.vercel.app').replace(/\/+$/, '');
  return `${base}${path}`;
}

function profileImageUrl() {
  return envValue('BROKER_PHOTO_URL', publicAssetUrl('/assets/noman-profile.jpg'));
}

function brokerCardUrl() {
  return envValue('BROKER_CARD_URL', publicAssetUrl('/assets/broker-card.jpg'));
}

function paragraphHtml(body) {
  return String(body)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 14px;color:#20332b;font-size:15px;line-height:1.65">${line}</p>`)
    .join('');
}

export function htmlEmail(body, contact) {
  const formUrl = contact?.token ? publicFormUrl(contact) : envValue('PUBLIC_FORM_BASE_URL');
  const replyEmail = envValue('FROM_EMAIL', envValue('SMTP_USER', 'noman@xsite.ae'));
  const brandName = envValue('FROM_NAME', 'Xsite Real Estate');
  const websiteUrl = envValue('WEBSITE_URL', 'https://www.nomanproperties.com');

  return `
    <div style="margin:0;padding:0;background:#f4f6f4;font-family:Arial,Helvetica,sans-serif;color:#17201b">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f4;padding:26px 12px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #dde5df;border-radius:14px;overflow:hidden">
              <tr>
                <td style="background:#14221c;padding:24px 28px;color:#ffffff">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align:middle">
                        <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#d8b46a;font-weight:700">Verified Dubai Broker</div>
                        <div style="font-size:25px;line-height:1.2;font-weight:800;margin-top:8px">Hafiz Muhammad Noman Farman Ali</div>
                        <div style="font-size:14px;color:#dce7e1;margin-top:8px">Property Consultant | ${brandName}</div>
                      </td>
                      <td width="96" align="right" style="vertical-align:middle">
                        <img src="${profileImageUrl()}" width="84" height="84" alt="Muhammad Noman" style="display:block;width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #d8b46a">
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:26px 28px 10px">
                  <div style="border-left:4px solid #d8b46a;padding-left:16px;margin-bottom:22px">
                    <div style="font-size:18px;font-weight:800;color:#14221c">Property details request</div>
                    <div style="font-size:13px;color:#65746b;margin-top:6px">For green-list record verification and requirement matching.</div>
                  </div>
                  ${paragraphHtml(body)}
                </td>
              </tr>

              <tr>
                <td style="padding:4px 28px 26px">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%">
                    <tr>
                      <td style="padding:0 0 10px">
                        <a href="${formUrl}" style="display:block;background:#167a46;color:#ffffff;text-decoration:none;text-align:center;font-weight:800;border-radius:9px;padding:14px 18px;font-size:15px">Submit Property Details</a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                          <tr>
                            <td width="50%" style="padding-right:5px">
                              <a href="mailto:${replyEmail}" style="display:block;background:#eef5f0;color:#0f5834;text-decoration:none;text-align:center;font-weight:800;border:1px solid #c9dfd0;border-radius:9px;padding:12px 14px;font-size:14px">Reply by Email</a>
                            </td>
                            <td width="50%" style="padding-left:5px">
                              <a href="${websiteUrl}" style="display:block;background:#fff8e9;color:#6d4a0f;text-decoration:none;text-align:center;font-weight:800;border:1px solid #ead7a6;border-radius:9px;padding:12px 14px;font-size:14px">Visit Website</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 24px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7faf7;border:1px solid #dde5df;border-radius:12px">
                    <tr>
                      <td style="padding:18px">
                        <div style="font-size:14px;font-weight:800;color:#14221c;margin-bottom:12px">Broker Details</div>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;color:#526158;line-height:1.7">
                          <tr><td style="padding:3px 0;width:145px">Broker Card No.</td><td style="padding:3px 0;color:#17201b;font-weight:700">78569</td></tr>
                          <tr><td style="padding:3px 0">Office</td><td style="padding:3px 0;color:#17201b;font-weight:700">Xsite Real Estate Brokers L.L.C (Branch)</td></tr>
                          <tr><td style="padding:3px 0">Activities</td><td style="padding:3px 0;color:#17201b;font-weight:700">Buying, selling and leasing brokerage</td></tr>
                          <tr><td style="padding:3px 0">Card Expiry</td><td style="padding:3px 0;color:#17201b;font-weight:700">09/07/2026</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 28px 26px">
                  <img src="${brokerCardUrl()}" width="624" alt="Dubai broker card" style="display:block;width:100%;max-width:624px;border-radius:12px;border:1px solid #dde5df">
                </td>
              </tr>

              <tr>
                <td style="background:#f7faf7;border-top:1px solid #dde5df;padding:18px 28px;color:#68766d;font-size:12px;line-height:1.6">
                  This message is sent only to green-list contacts for property service follow-up. If you do not wish to be contacted, reply with "STOP" and communication will be stopped.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function sendContactEmail({ transporter, contact, subject, body }) {
  await transporter.sendMail({
    from: `"${envValue('FROM_NAME', 'Xsite Real Estate')}" <${envValue('FROM_EMAIL', envValue('SMTP_USER'))}>`,
    to: contact.email,
    subject,
    text: body,
    html: htmlEmail(body, contact)
  });
}
