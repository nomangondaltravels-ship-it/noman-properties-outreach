import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    fromEmail: process.env.FROM_EMAIL || process.env.SMTP_USER || '',
    publicFormBaseUrl: process.env.PUBLIC_FORM_BASE_URL || 'http://localhost:3000'
  });
}
