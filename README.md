# Noman Properties Outreach

Separate outreach system for green-list imports, email campaigns, and client property detail forms.

Recommended live URL:

```text
https://outreach.nomanproperties.com
```

## Stack

- Vercel hosting
- Next.js app and API routes
- Supabase database
- SMTP professional email

## Supabase Setup

1. Create a new Supabase project.
2. Open Supabase SQL Editor.
3. Run [supabase/schema.sql](/Users/noman/Documents/New%20project%203/supabase/schema.sql).
4. Copy these values from Supabase:
   - Project URL
   - anon public key
   - service role key

## Environment Variables

Add these in Vercel Project Settings > Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SMTP_HOST=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@nomanproperties.com
SMTP_PASS=

PUBLIC_FORM_BASE_URL=https://outreach.nomanproperties.com
FROM_NAME=Noman Properties
FROM_EMAIL=info@nomanproperties.com
CRON_SECRET=choose-a-long-random-secret
AUTO_EMAIL_BATCH_SIZE=20
```

Keep `SUPABASE_SERVICE_ROLE_KEY` private. Do not expose it in browser code.

## Auto Email

The app includes an `/api/auto-email` endpoint. It sends ready contacts in batches during 10:00 AM-6:00 PM Dubai time.

Call it with:

```text
https://your-domain/api/auto-email?secret=your-cron-secret
```

For hourly automatic sending, use Vercel Cron on a plan that supports the needed frequency, or use an external scheduler.

## WhatsApp

WhatsApp buttons open a prefilled message through `wa.me`. Fully automatic WhatsApp sending requires the official WhatsApp Business API.

## Vercel Deployment

1. Push this project to GitHub.
2. In Vercel, create a new project from that GitHub repo.
3. Add all environment variables.
4. Deploy.
5. In Vercel Project Settings > Domains, add:

```text
outreach.nomanproperties.com
```

6. Vercel will show a CNAME record. Add that CNAME in your domain DNS panel.

## Import Format

Excel/CSV columns supported:

- Name
- Service Category
- Property Type
- Area
- Budget (AED)
- Email
- Phone
- Subscription End Date
