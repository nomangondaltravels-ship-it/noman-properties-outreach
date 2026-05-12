import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    fromEmail: process.env.FROM_EMAIL || process.env.SMTP_USER || '',
    publicFormBaseUrl: process.env.PUBLIC_FORM_BASE_URL || 'http://localhost:3000',
    brokerEmail: process.env.BROKER_EMAIL || process.env.FROM_EMAIL || process.env.SMTP_USER || '',
    brokerName: process.env.BROKER_NAME || 'Hafiz Muhammad Noman Farman Ali',
    brokerId: process.env.BROKER_ID || '78569',
    brokerWhatsAppNumber: process.env.BROKER_WHATSAPP_NUMBER || '',
    companyName: process.env.FROM_NAME || 'Xsite Real Estate',
    websiteUrl: process.env.WEBSITE_URL || 'https://www.nomanproperties.com'
  });
}
