import { NextResponse } from 'next/server';
import { defaultEmailBody, defaultEmailSubject, getTransporter, sendContactEmail, smtpConfigured } from '@/lib/email';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { renderTemplate } from '@/lib/templates';
import { canEmailContact, templateForContact } from '@/lib/compliance';

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
  const subjectTemplate = process.env.AUTO_EMAIL_SUBJECT || '';
  const bodyTemplate = process.env.AUTO_EMAIL_BODY || '';

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .not('email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(batchSize * 4);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const eligibleContacts = contacts.filter((contact) => canEmailContact(contact).ok).slice(0, batchSize);
  if (!eligibleContacts.length) return NextResponse.json({ sent: 0, message: 'No eligible contacts with email.' });

  const transporter = getTransporter();
  const results = [];

  for (const contact of eligibleContacts) {
    try {
      const categoryTemplate = templateForContact(contact);
      const subject = renderTemplate(subjectTemplate || categoryTemplate.subject || defaultEmailSubject, contact);
      const body = renderTemplate(bodyTemplate || categoryTemplate.body || defaultEmailBody, contact);
      await sendContactEmail({ transporter, contact, subject, body });
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          status: 'emailed',
          last_emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
      if (updateError) throw updateError;
      results.push({ id: contact.id, email: contact.email, status: 'sent' });
    } catch (sendError) {
      results.push({ id: contact.id, email: contact.email, status: 'failed', error: sendError.message });
    }
  }

  await supabase.from('campaigns').insert({
    subject: subjectTemplate,
    body: bodyTemplate,
    dry_run: false,
    count: eligibleContacts.length,
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
