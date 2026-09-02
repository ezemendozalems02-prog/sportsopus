-- SportControl — capa SaaS: planes, prueba gratis y facturación de la
-- suscripción (distinta de los pagos de canchas/productos, que ya cubre
-- booking_payments / cash_movements). Depends on 0001_init.sql.
--
-- Los planes en sí (Starter/Pro/Business, sus precios y qué desbloquean) NO
-- están en una tabla — viven como configuración en el código
-- (src/lib/db.ts → PLANS), igual que en la mayoría de los SaaS reales donde
-- el catálogo de precios se define en el proveedor de cobro (acá: Mercado
-- Pago Suscripciones) o en config, no en una tabla de negocio.

create type plan_id as enum ('starter', 'pro', 'business');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

alter table organizations
  add column plan plan_id not null default 'starter',
  add column subscription_status subscription_status not null default 'trialing',
  add column billing_email text,
  add column trial_ends_at timestamptz,
  add column current_period_end timestamptz,
  add column mercadopago_subscription_id text;

create type invoice_status as enum ('pagada', 'pendiente', 'fallida');

create table billing_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan plan_id not null,
  amount_usd numeric(10,2) not null,
  status invoice_status not null default 'pendiente',
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now()
);

create index idx_billing_invoices_org on billing_invoices(organization_id, created_at desc);

alter table billing_invoices enable row level security;

create policy "org scoped access" on billing_invoices
  for all using (organization_id = auth_organization_id());

-- Nota sobre RLS de organizations: la policy "org members read own org" de
-- 0001_init.sql ya alcanza para que cada complejo solo vea su propia fila
-- (con su plan/estado de suscripción incluidos). El signup real (crear una
-- organización nueva) requiere un flujo server-side con la service role key,
-- ya que un usuario recién registrado todavía no tiene organization_id.
