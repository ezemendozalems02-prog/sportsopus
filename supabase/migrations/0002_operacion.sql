-- SportControl — Fase 2 (Operación) schema: productos, inventario, caja/POS,
-- gastos y auditoría. Depends on 0001_init.sql (organizations, employees).

-- ---------------------------------------------------------------------------
-- Productos e inventario
-- ---------------------------------------------------------------------------

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid not null references product_categories(id) on delete restrict,
  name text not null,
  sku text not null,
  cost numeric(10,2) not null default 0,
  price numeric(10,2) not null,
  stock integer not null default 0,
  min_stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, sku)
);

-- ---------------------------------------------------------------------------
-- Caja / POS
-- ---------------------------------------------------------------------------

create type cash_session_status as enum ('abierta', 'cerrada');

create table cash_registers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id),
  status cash_session_status not null default 'abierta',
  opening_amount numeric(10,2) not null,
  opened_at timestamptz not null default now(),
  closing_counted_amount numeric(10,2),
  closed_at timestamptz
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cash_session_id uuid references cash_registers(id),
  employee_id uuid not null references employees(id),
  total numeric(10,2) not null,
  method payment_method not null,
  created_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  name text not null, -- snapshot: survives later product renames/price changes
  quantity integer not null,
  unit_price numeric(10,2) not null
);

create type cash_movement_type as enum ('venta', 'cobro_reserva', 'ingreso_manual', 'egreso_manual', 'gasto');

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cash_session_id uuid not null references cash_registers(id) on delete cascade,
  type cash_movement_type not null,
  amount numeric(10,2) not null, -- positivo = entra a la caja, negativo = sale
  method payment_method not null,
  concept text not null,
  employee_id uuid not null references employees(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------------

create type expense_category as enum (
  'luz', 'agua', 'alquiler', 'sueldos', 'mantenimiento',
  'insumos', 'limpieza', 'publicidad', 'reparaciones', 'otro'
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id),
  category expense_category not null,
  description text not null,
  amount numeric(10,2) not null,
  date date not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id),
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_products_org on products(organization_id);
create index idx_sales_org_date on sales(organization_id, created_at);
create index idx_sale_items_sale on sale_items(sale_id);
create index idx_cash_movements_session on cash_movements(cash_session_id);
create index idx_cash_registers_org on cash_registers(organization_id, status);
create index idx_expenses_org_date on expenses(organization_id, date);
create index idx_audit_logs_org_date on audit_logs(organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — same organization-scoped pattern as 0001_init.sql.
-- ---------------------------------------------------------------------------

alter table product_categories enable row level security;
alter table products enable row level security;
alter table cash_registers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table cash_movements enable row level security;
alter table expenses enable row level security;
alter table audit_logs enable row level security;

create policy "org scoped access" on product_categories
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on products
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on cash_registers
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on sales
  for all using (organization_id = auth_organization_id());

create policy "org scoped access via sale" on sale_items
  for all using (
    sale_id in (select id from sales where organization_id = auth_organization_id())
  );

create policy "org scoped access" on cash_movements
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on expenses
  for all using (organization_id = auth_organization_id());

create policy "org scoped access, staff only" on audit_logs
  for all using (
    organization_id = auth_organization_id()
    and exists (select 1 from employees where user_id = auth.uid() and organization_id = auth_organization_id())
  );
