import { NextResponse } from 'next/server';
import { defaultEmailBody, defaultEmailSubject, getTransporter, sendContactEmail, smtpConfigured } from '@/lib/email';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { renderTemplate } from '@/lib/templates';

export const runtime = 'nodejs';

function dubaiHour() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Asia/Dubai'
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === 'hour')?.value || 0);
}

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  const url = new URL(request.url);
  return auth === `Bearer ${secret}` || url.searchParams.get('secret') === secret;
}

async function runAutoEmail(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'CRON_SECRET is required for auto email.' }, { status: 401 });
  }

  const hour = dubaiHour();
  if (hour < 10 || hour > 18) {
    return NextResponse.json({ skipped: true, reason: 'Outside 10am-6pm Dubai sending window.', hour });
  }

  if (!smtpConfigured()) {
    return NextResponse.json({ error: 'SMTP is not configured.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const batchSize = Number(process.env.AUTO_EMAIL_BATCH_SIZE || 20);
  const subjectTemplate = process.env.AUTO_EMAIL_SUBJECT || defaultEmailSubject;
  const bodyTemplate = process.env.AUTO_EMAIL_BODY || defaultEmailBody;

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('status', 'ready')
    .not('email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contacts.length) return NextResponse.json({ sent: 0, message: 'No ready contacts with email.' });

  const transporter = getTransporter();
  const results = [];

  for (const contact of contacts) {
    try {
      const subject = renderTemplate(subjectTemplate, contact);
      const body = renderTemplate(bodyTemplate, contact);
      await sendContactEmail({ transporter, contact, subject, body });
      await supabase
        .from('contacts')
        .update({
          status: 'emailed',
          last_emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
      results.push({ id: contact.id, email: contact.email, status: 'sent' });
    } catch (sendError) {
      results.push({ id: contact.id, email: contact.email, status: 'failed', error: sendError.message });
    }
  }

  await supabase.from('campaigns').insert({
    subject: subjectTemplate,
    body: bodyTemplate,
    dry_run: false,
    count: contacts.length,
    results
  });

  return NextResponse.json({
    sent: results.filter((item) => item.status === 'sent').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results
  });
}

export async function GET(request) {
  return runAutoEmail(request);
}

export async function POST(request) {
  return runAutoEmail(request);
}
