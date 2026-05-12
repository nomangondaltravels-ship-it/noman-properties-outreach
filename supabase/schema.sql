create extension if not exists "pgcrypto";

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text,
  service_category text,
  property_type text,
  area text,
  budget text,
  email text,
  phone text,
  subscription_end_date text,
  status text not null default 'ready',
  last_emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_email_unique
  on contacts (lower(email))
  where email is not null and email <> '';

create unique index if not exists contacts_phone_unique
  on contacts (phone)
  where phone is not null and phone <> '';

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  requirement text,
  property_type text,
  area text,
  building text,
  bedrooms text,
  size text,
  price text,
  availability text,
  name text,
  phone text,
  email text,
  preferred_contact text,
  callback_date text,
  callback_time text,
  meeting_preference text,
  notes text,
  submitted_at timestamptz not null default now()
);

alter table responses add column if not exists callback_date text;
alter table responses add column if not exists callback_time text;
alter table responses add column if not exists meeting_preference text;

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text,
  body text,
  dry_run boolean not null default false,
  count integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  sent_at timestamptz not null default now()
);

alter table contacts enable row level security;
alter table responses enable row level security;
alter table campaigns enable row level security;
