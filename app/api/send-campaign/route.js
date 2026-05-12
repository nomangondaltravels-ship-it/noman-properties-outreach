import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { renderTemplate } from '@/lib/templates';

export const runtime = 'nodejs';

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function htmlEmail(body) {
  return `
    <div style="font-family:Arial,sans-serif;color:#17201b;line-height:1.55;font-size:15px">
      ${String(body).split('\n').map((line) => `<p style="margin:0 0 12px">${line}</p>`).join('')}
    </div>
  `;
}

function getTransporter() {
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

export async function POST(request) {
  const { subject, body, ids = [], dryRun = true } = await request.json();
  const supabase = getSupabaseAdmin();

  const { data: selected, error } = await supabase
    .from('contacts')
    .select('*')
    .in('id', ids)
    .not('email', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!selected.length) return NextResponse.json({ error: 'No contacts with email selected.' }, { status: 400 });
  if (!dryRun && !smtpConfigured()) return NextResponse.json({ error: 'SMTP is not configured.' }, { status: 400 });

  const transporter = dryRun ? null : getTransporter();
  const results = [];

  for (const contact of selected) {
    const renderedSubject = renderTemplate(subject, contact);
    const renderedBody = renderTemplate(body, contact);

    if (dryRun) {
      results.push({ id: contact.id, email: contact.email, status: 'preview', subject: renderedSubject });
      continue;
    }

    try {
      await transporter.sendMail({
        from: `"${process.env.FROM_NAME || 'Noman Properties'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: contact.email,
        subject: renderedSubject,
        text: renderedBody,
        html: htmlEmail(renderedBody)
      });
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
    subject,
    body,
    dry_run: dryRun,
    count: selected.length,
    results
  });

  return NextResponse.json({ results });
}
