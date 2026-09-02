-- SportControl — Fase 3 (Crecimiento) schema: promociones, fidelización,
-- lista de espera, notificaciones y torneos. Depends on 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Promociones
-- ---------------------------------------------------------------------------

create table promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  discount_percentage numeric(4,3) not null,
  days_of_week smallint[] not null,
  start_time time not null,
  end_time time not null,
  sports sport[], -- null/empty = aplica a todos los deportes
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Fidelización
-- ---------------------------------------------------------------------------

create type loyalty_reward_kind as enum ('descuento', 'producto', 'hora_bonificada');

create table loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  points_cost integer not null,
  kind loyalty_reward_kind not null
);

create table loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  reward_id uuid not null references loyalty_rewards(id),
  points_spent integer not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lista de espera
-- ---------------------------------------------------------------------------

create type waitlist_status as enum ('esperando', 'notificado', 'expirado', 'reservado');

create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  date date not null,
  start_time time not null,
  status waitlist_status not null default 'esperando',
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Notificaciones (WhatsApp/email — simulado hasta conectar un proveedor real)
-- ---------------------------------------------------------------------------

create type notification_channel as enum ('whatsapp', 'email');
create type notification_kind as enum (
  'reserva_confirmada', 'recordatorio', 'cancelacion', 'lista_espera_liberada', 'torneo_inscripcion'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  channel notification_channel not null,
  kind notification_kind not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Torneos
-- ---------------------------------------------------------------------------

create type tournament_status as enum ('inscripcion', 'en_curso', 'finalizado');

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sport sport not null,
  category text not null,
  date date not null,
  max_teams integer not null, -- potencia de 2 (4, 8, 16, 32)
  entry_fee numeric(10,2) not null,
  prize text not null,
  status tournament_status not null default 'inscripcion',
  created_at timestamptz not null default now()
);

create table tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  player_names text[] not null,
  customer_id uuid references customers(id),
  paid_entry boolean not null default false,
  registered_at timestamptz not null default now()
);

create type tournament_match_status as enum ('pendiente', 'bye', 'jugado');

create table tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round integer not null, -- 1 = primera ronda
  match_index integer not null, -- posición dentro de la ronda
  team_a_id uuid references tournament_teams(id),
  team_b_id uuid references tournament_teams(id),
  score_label text,
  winner_team_id uuid references tournament_teams(id),
  status tournament_match_status not null default 'pendiente',
  unique (tournament_id, round, match_index)
);

-- El ranking (RankingEntry en la app) se calcula on-the-fly a partir de
-- tournament_matches ganados — no necesita tabla propia; ver computeRanking()
-- en src/lib/db.ts para portarlo a una vista o función de Postgres.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_promotions_org on promotions(organization_id, active);
create index idx_loyalty_redemptions_customer on loyalty_redemptions(customer_id);
create index idx_waitlist_slot on waitlist_entries(court_id, date, start_time, status);
create index idx_waitlist_customer on waitlist_entries(customer_id);
create index idx_notifications_customer on notifications(customer_id, created_at desc);
create index idx_tournaments_org on tournaments(organization_id, status);
create index idx_tournament_teams_tournament on tournament_teams(tournament_id);
create index idx_tournament_matches_tournament on tournament_matches(tournament_id, round, match_index);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table promotions enable row level security;
alter table loyalty_rewards enable row level security;
alter table loyalty_redemptions enable row level security;
alter table waitlist_entries enable row level security;
alter table notifications enable row level security;
alter table tournaments enable row level security;
alter table tournament_teams enable row level security;
alter table tournament_matches enable row level security;

create policy "org scoped access" on promotions
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on loyalty_rewards
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on loyalty_redemptions
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on waitlist_entries
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on notifications
  for all using (organization_id = auth_organization_id());

create policy "org scoped access" on tournaments
  for all using (organization_id = auth_organization_id());

create policy "org scoped access via tournament" on tournament_teams
  for all using (
    tournament_id in (select id from tournaments where organization_id = auth_organization_id())
  );

create policy "org scoped access via tournament" on tournament_matches
  for all using (
    tournament_id in (select id from tournaments where organization_id = auth_organization_id())
  );
