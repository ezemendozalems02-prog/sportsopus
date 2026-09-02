-- SportControl — Fase 1 (Core) schema.
-- Multi-tenant: every business table carries organization_id and is
-- protected by row-level security scoped to it, so one Postgres instance
-- safely serves every complejo.
--
-- Mirrors the shapes in src/lib/types.ts — once this is applied and
-- NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set, the
-- functions in src/lib/db.ts should be swapped for real queries against
-- these tables, one at a time, without changing the page/component code
-- above them.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations, roles and staff
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  deposit_percentage numeric(4,3) not null default 0.30,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

create type employee_role as enum ('owner', 'admin', 'cajero');

create table employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  role employee_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  favorite_sport text,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

-- ---------------------------------------------------------------------------
-- Courts, schedules and pricing
-- ---------------------------------------------------------------------------

create type sport as enum ('padel', 'futbol5', 'futbol8', 'futbol11');
create type court_surface as enum ('sintetico', 'cemento', 'polvo_de_ladrillo', 'parquet');

create table courts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sport sport not null,
  surface court_surface not null,
  indoor boolean not null default false,
  lighting boolean not null default true,
  slot_minutes integer not null default 90,
  open_time time not null,
  close_time time not null,
  days_open smallint[] not null default '{0,1,2,3,4,5,6}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per pricing window (hora valle/normal/pico, fin de semana, etc).
create table court_price_rules (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  label text not null,
  days_of_week smallint[] not null,
  start_time time not null,
  end_time time not null,
  price_per_slot numeric(10,2) not null
);

-- ---------------------------------------------------------------------------
-- Bookings and payments
-- ---------------------------------------------------------------------------

create type booking_status as enum (
  'pendiente_pago', 'sena_pagada', 'confirmada', 'en_curso',
  'finalizada', 'cancelada', 'no_show'
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  total_price numeric(10,2) not null,
  deposit_amount numeric(10,2) not null,
  balance_amount numeric(10,2) not null,
  status booking_status not null default 'pendiente_pago',
  created_at timestamptz not null default now(),
  -- One slot per court can only be booked once while it's still "active".
  unique (court_id, date, start_time)
);

create type payment_method as enum ('mercado_pago', 'efectivo', 'transferencia', 'tarjeta', 'otro');
create type payment_concept as enum ('sena', 'saldo', 'pago_completo');
create type payment_status as enum ('aprobado', 'pendiente', 'rechazado');

create table booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  concept payment_concept not null,
  amount numeric(10,2) not null,
  method payment_method not null,
  status payment_status not null default 'pendiente',
  mercadopago_payment_id text,
  paid_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_courts_org on courts(organization_id);
create index idx_bookings_org_date on bookings(organization_id, date);
create index idx_bookings_court_date on bookings(court_id, date);
create index idx_bookings_customer on bookings(customer_id);
create index idx_customers_org on customers(organization_id);
create index idx_price_rules_court on court_price_rules(court_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — every table is scoped to the caller's organization.
-- Adjust the `auth_organization_id()` helper once Supabase Auth is wired up
-- (e.g. read organization_id from a custom JWT claim or an employees/customers lookup).
-- ---------------------------------------------------------------------------

create or replace function auth_organization_id() returns uuid as $$
  select coalesce(
    (select organization_id from employees where user_id = auth.uid()),
    (select organization_id from customers where user_id = auth.uid())
  );
$$ language sql stable security definer;

alter table organizations enable row level security;
alter table employees enable row level security;
alter table customers enable row level security;
alter table courts enable row level security;
alter table court_price_rules enable row level security;
alter table bookings enable row level security;
alter table booking_payments enable row level security;

create policy "org members read own org" on organizations
  for select using (id = auth_organization_id());

create policy "org scoped access" on employees
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on customers
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on courts
  for all using (organization_id = auth_organization_id());

create policy "org scoped access via court" on court_price_rules
  for all using (
    court_id in (select id from courts where organization_id = auth_organization_id())
  );

create policy "org scoped access" on bookings
  for all using (organization_id = auth_organization_id());

create policy "org scoped access via booking" on booking_payments
  for all using (
    booking_id in (select id from bookings where organization_id = auth_organization_id())
  );

-- ---------------------------------------------------------------------------
-- Fase 2 (productos, caja/POS, gastos, auditoría) continues in
-- 0002_operacion.sql. Fase 3+ (tournaments, promotions, notifications, ...)
-- isn't modeled yet.
-- ---------------------------------------------------------------------------
