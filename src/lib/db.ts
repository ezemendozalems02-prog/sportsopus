import "server-only";
import type {
  AuditLogEntry, BillingInvoice, Booking, BookingPayment, BookingStatus,
  CashMovement, CashRegisterSession, Court, CourtSurface, Customer, Employee,
  EmployeeRole, Expense, ExpenseCategory, LoyaltyRedemption, LoyaltyReward,
  NotificationChannel, NotificationEntry, NotificationKind, Organization,
  PaymentMethod, Plan, PlanFeatureGroup, PlanId, PlatformAdmin, PriceRule,
  Product, ProductCategory, Promotion, RankingEntry, Sale, SaleItem, Sport,
  SubscriptionStatus, Tournament, TournamentMatch, TournamentTeam,
  WaitlistEntry,
} from "./types";
import { BLOCKING_STATUSES, generateSlots } from "./availability";
import { applyPromotion, computeDeposit, findApplicablePromotion, resolveSlotPrice } from "./pricing";
import { addDaysISO, dayOfWeek, minutesToTime, timeToMinutes, todayISO } from "./time";
import { supabaseAdmin } from "./supabase/admin";
import { fetchPreapproval } from "./mercadopago";
import {
  mapAuditLog, mapBillingInvoice, mapBooking, mapCashMovement, mapCashSession,
  mapCourt, mapCustomer, mapEmployee, mapExpense, mapLoyaltyRedemption,
  mapLoyaltyReward, mapNotification, mapOrganization, mapProduct,
  mapProductCategory, mapPromotion, mapSale, mapTournament,
  mapTournamentMatch, mapTournamentTeam, mapWaitlistEntry,
} from "./supabase/mappers";

// ---------------------------------------------------------------------------
// Capa de datos de SportControl — Postgres real (Supabase), vía la service
// role key (src/lib/supabase/admin.ts). Esta app nunca llama a Supabase
// directo desde el browser: todo pasa por Server Components/Server Actions
// de Next, que ya son el límite de confianza real, así que cada función
// sigue filtrando explícitamente por organizationId (igual disciplina que
// tenía el mock con los arrays en memoria) en vez de depender de RLS como
// mecanismo principal — ver el comentario en supabase/migrations/0001_init.sql
// y 0005_multitenant_auth.sql.
// ---------------------------------------------------------------------------

function db() {
  return supabaseAdmin();
}

function must<T>(data: T | null, error: unknown, notFoundMsg = "No encontrado"): T {
  if (error) throw error instanceof Error ? error : new Error(String(error));
  if (data == null) throw new Error(notFoundMsg);
  return data;
}

function formatArs(amount: number) {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

// ---------------------------------------------------------------------------
// Planes (catálogo en código, no en tabla — ver 0004_saas.sql)
// ---------------------------------------------------------------------------

// Dólar blue de referencia al conectar Mercado Pago (2026-09-04) — fijo por
// ahora, ver nota en changePlanAction/PLANS sobre actualizarlo a futuro.
const USD_TO_ARS = 1540;

// mpPreapprovalPlanId/mpCheckoutUrl: planes de suscripción reales creados en
// Mercado Pago (app "SportControl", id 3613866164034514) el 2026-09-04, con
// credenciales de TEST — cobran el monto en ARS de auto_recurring de cada uno
// (ver USD_TO_ARS arriba). Para pasar a producción hace falta activar las
// credenciales de producción de la app en el panel de Mercado Pago y volver
// a crear estos mismos planes con esas credenciales.
const PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", priceUSD: 27,
    tagline: "Para arrancar a ordenar las reservas",
    featureGroups: [],
    highlights: ["Reservas online con seña", "Agenda y canchas", "Clientes", "Facturación semanal de canchas"],
    mpPreapprovalPlanId: "4b19abaa7562444eb83ed2b6713e92e9",
    mpCheckoutUrl: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=4b19abaa7562444eb83ed2b6713e92e9",
  },
  {
    id: "pro", name: "Pro", priceUSD: 57,
    tagline: "Para manejar todo el día a día del complejo",
    featureGroups: ["operacion"],
    highlights: ["Todo lo de Starter", "Caja y punto de venta", "Inventario y gastos", "Empleados y auditoría"],
    mpPreapprovalPlanId: "9f0837d83b4143039713798cd9163d70",
    mpCheckoutUrl: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=9f0837d83b4143039713798cd9163d70",
  },
  {
    id: "business", name: "Business", priceUSD: 97,
    tagline: "Para crecer con torneos, fidelización y datos",
    featureGroups: ["operacion", "crecimiento", "inteligencia"],
    highlights: ["Todo lo de Pro", "Torneos, ranking y fidelización", "Promociones y lista de espera", "Analítica, alertas y reportes"],
    mpPreapprovalPlanId: "e8cc5778b47d4158b37b18357f2c6d8a",
    mpCheckoutUrl: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=e8cc5778b47d4158b37b18357f2c6d8a",
  },
];

export function listPlans(): Plan[] {
  return PLANS;
}

export function getPlan(planId: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function getPlanByMpPreapprovalPlanId(mpPreapprovalPlanId: string): Plan | undefined {
  return PLANS.find((p) => p.mpPreapprovalPlanId === mpPreapprovalPlanId);
}

export function priceInArs(priceUSD: number): number {
  return priceUSD * USD_TO_ARS;
}

// ---------------------------------------------------------------------------
// Superadmin (dueño de la plataforma) — credenciales por env var, sin tabla.
// No es un tenant y no necesita Supabase Auth; se mantiene igual que antes
// para que pueda convivir en el mismo navegador con una sesión de empleado.
// ---------------------------------------------------------------------------

const platformAdmin: PlatformAdmin = {
  id: "padmin_1",
  email: process.env.SUPERADMIN_EMAIL ?? "admin@sportcontrol.app",
  password: process.env.SUPERADMIN_PASSWORD ?? "super1234",
};

export function verifyPlatformAdminCredentials(email: string, password: string): PlatformAdmin | undefined {
  return platformAdmin.email.trim().toLowerCase() === email.trim().toLowerCase() &&
    platformAdmin.password.trim() === password.trim()
    ? platformAdmin
    : undefined;
}

// ---------------------------------------------------------------------------
// Precios base para canchas nuevas (seed de una org nueva / createCourt)
// ---------------------------------------------------------------------------

export function weekdayPadelRules(base: number): Omit<PriceRule, "id">[] {
  return [
    { label: "Hora valle", daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "16:00", pricePerSlot: base },
    { label: "Hora normal", daysOfWeek: [1, 2, 3, 4, 5], startTime: "16:00", endTime: "18:00", pricePerSlot: Math.round(base * 1.2) },
    { label: "Hora pico", daysOfWeek: [1, 2, 3, 4, 5], startTime: "18:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.47) },
    { label: "Fin de semana", daysOfWeek: [0, 6], startTime: "08:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.67) },
  ];
}

export function weekdayFutbolRules(base: number): Omit<PriceRule, "id">[] {
  return [
    { label: "Hora valle", daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", pricePerSlot: base },
    { label: "Hora pico", daysOfWeek: [1, 2, 3, 4, 5], startTime: "17:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.45) },
    { label: "Fin de semana", daysOfWeek: [0, 6], startTime: "09:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.6) },
  ];
}

async function insertCourtWithRules(organizationId: string, court: {
  name: string; sport: Sport; surface: CourtSurface; indoor: boolean; lighting: boolean;
  slotMinutes: number; openTime: string; closeTime: string;
}, rules: Omit<PriceRule, "id">[]): Promise<Court> {
  const { data: courtRow, error } = await db()
    .from("courts")
    .insert({
      organization_id: organizationId,
      name: court.name,
      sport: court.sport,
      surface: court.surface,
      indoor: court.indoor,
      lighting: court.lighting,
      slot_minutes: court.slotMinutes,
      open_time: court.openTime,
      close_time: court.closeTime,
      days_open: [0, 1, 2, 3, 4, 5, 6],
    })
    .select()
    .single();
  must(courtRow, error);

  const { error: rulesError } = await db().from("court_price_rules").insert(
    rules.map((r) => ({
      court_id: courtRow.id,
      label: r.label,
      days_of_week: r.daysOfWeek,
      start_time: r.startTime,
      end_time: r.endTime,
      price_per_slot: r.pricePerSlot,
    }))
  );
  if (rulesError) throw rulesError;

  const court2 = await getCourt(organizationId, courtRow.id);
  return court2!;
}

async function seedDefaultLoyaltyRewardsFor(organizationId: string) {
  await db().from("loyalty_rewards").insert([
    { organization_id: organizationId, label: "Bebida gratis", points_cost: 150, kind: "producto" },
    { organization_id: organizationId, label: "$10.000 de descuento", points_cost: 1000, kind: "descuento" },
    { organization_id: organizationId, label: "Hora bonificada", points_cost: 1800, kind: "hora_bonificada" },
  ]);
}

// ---------------------------------------------------------------------------
// Organizaciones (multi-tenant)
// ---------------------------------------------------------------------------

const RESERVED_SLUGS = new Set([
  "admin", "superadmin", "login", "registro", "planes", "api",
  "reservar", "mis-reservas", "torneos", "beneficios", "favicon.ico",
]);

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "complejo";
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const { data } = await db().from("organizations").select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base) && !RESERVED_SLUGS.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`) || RESERVED_SLUGS.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const TRIAL_DAYS = 7;

export async function createOrganization(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  planId: PlanId;
}): Promise<{ organization: Organization; owner: Employee }> {
  const { data: authUser, error: authError } = await db().auth.admin.createUser({
    email: input.ownerEmail,
    password: input.ownerPassword,
    email_confirm: true,
  });
  if (authError) {
    throw new Error(authError.message.includes("already been registered") ? "Ya existe una cuenta con ese email" : authError.message);
  }

  const slug = await generateUniqueSlug(input.name);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: orgRow, error: orgError } = await db()
    .from("organizations")
    .insert({
      name: input.name,
      slug,
      plan: input.planId,
      subscription_status: "trialing",
      billing_email: input.ownerEmail,
      trial_ends_at: trialEndsAt,
    })
    .select()
    .single();
  if (orgError) {
    await db().auth.admin.deleteUser(authUser.user.id);
    throw orgError;
  }

  const { data: empRow, error: empError } = await db()
    .from("employees")
    .insert({
      organization_id: orgRow.id,
      user_id: authUser.user.id,
      name: input.ownerName,
      email: input.ownerEmail,
      role: "owner",
    })
    .select()
    .single();
  if (empError) throw empError;

  await Promise.all([
    insertCourtWithRules(orgRow.id, {
      name: "Cancha de pádel 1", sport: "padel", surface: "sintetico", indoor: true, lighting: true,
      slotMinutes: 90, openTime: "08:00", closeTime: "23:00",
    }, weekdayPadelRules(15000)),
    insertCourtWithRules(orgRow.id, {
      name: "Fútbol 5", sport: "futbol5", surface: "sintetico", indoor: false, lighting: true,
      slotMinutes: 60, openTime: "09:00", closeTime: "23:00",
    }, weekdayFutbolRules(18000)),
    seedDefaultLoyaltyRewardsFor(orgRow.id),
  ]);

  const organization = mapOrganization(orgRow);
  const owner = mapEmployee(empRow);
  await logAudit(organization.id, owner.id, "Cuenta creada", `${organization.name} · plan ${input.planId} · prueba gratis ${TRIAL_DAYS} días`);

  return { organization, owner };
}

export async function getOrganizationById(organizationId: string): Promise<Organization | undefined> {
  const { data } = await db().from("organizations").select("*").eq("id", organizationId).maybeSingle();
  return data ? mapOrganization(data) : undefined;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
  const { data } = await db().from("organizations").select("*").eq("slug", slug).maybeSingle();
  return data ? mapOrganization(data) : undefined;
}

export async function createCourt(organizationId: string, input: {
  name: string;
  sport: Sport;
  surface: CourtSurface;
  indoor: boolean;
  lighting: boolean;
  slotMinutes: number;
  openTime: string;
  closeTime: string;
  basePrice: number;
}): Promise<Court> {
  const rules = input.sport === "padel" ? weekdayPadelRules(input.basePrice) : weekdayFutbolRules(input.basePrice);
  return insertCourtWithRules(organizationId, input, rules);
}

export async function findOrCreateGuestCustomer(organizationId: string, input: { name: string; email: string; phone: string }): Promise<Customer> {
  const { data: existing } = await db()
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId)
    .ilike("email", input.email.trim())
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await db()
      .from("customers")
      .update({ name: input.name || existing.name, phone: input.phone || existing.phone })
      .eq("id", existing.id)
      .select()
      .single();
    must(updated, error);
    return mapCustomer(updated);
  }

  const { data, error } = await db()
    .from("customers")
    .insert({ organization_id: organizationId, name: input.name, email: input.email, phone: input.phone })
    .select()
    .single();
  must(data, error);
  return mapCustomer(data);
}

// ---- Superadmin (cross-tenant) --------------------------------------------
// Las funciones de acá abajo deliberadamente NO filtran por organizationId —
// es la única parte de la app pensada para ver todos los tenants a la vez.
// Nunca se deben usar desde una página del panel de un dueño de cancha.

export async function listOrganizations(): Promise<Organization[]> {
  const { data, error } = await db().from("organizations").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapOrganization);
}

export interface OrgSummary {
  organization: Organization;
  ownerEmail: string;
  employeeCount: number;
  courtCount: number;
  bookingCount: number;
  customerCount: number;
  activeCustomerCount: number;
}

export async function listOrgSummaries(): Promise<OrgSummary[]> {
  const organizations = await listOrganizations();
  const activeSinceISO = addDaysISO(todayISO(), -30);
  return Promise.all(
    organizations.map(async (organization) => {
      const [{ data: owner }, { count: employeeCount }, { count: courtCount }, { count: bookingCount }, { count: customerCount }, { data: recentBookings }] = await Promise.all([
        db().from("employees").select("email").eq("organization_id", organization.id).eq("role", "owner").maybeSingle(),
        db().from("employees").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
        db().from("courts").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
        db().from("bookings").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
        db().from("customers").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
        db().from("bookings").select("customer_id").eq("organization_id", organization.id).neq("status", "cancelada").gte("date", activeSinceISO),
      ]);
      const activeCustomerCount = new Set((recentBookings ?? []).map((b) => b.customer_id)).size;
      return {
        organization,
        ownerEmail: owner?.email ?? organization.billingEmail ?? "—",
        employeeCount: employeeCount ?? 0,
        courtCount: courtCount ?? 0,
        bookingCount: bookingCount ?? 0,
        customerCount: customerCount ?? 0,
        activeCustomerCount,
      };
    })
  );
}

export interface PlatformStats {
  totalOrgs: number;
  trialingCount: number;
  activeCount: number;
  pastDueCount: number;
  canceledCount: number;
  trialsEndingSoon: number;
  mrrUSD: number;
  planDistribution: { planId: PlanId; count: number }[];
  totalCustomers: number;
  activeCustomers: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const organizations = await listOrganizations();
  const byStatus = (status: SubscriptionStatus) => organizations.filter((o) => o.subscriptionStatus === status).length;
  const trialsEndingSoon = organizations.filter((o) => {
    if (o.subscriptionStatus !== "trialing" || !o.trialEndsAt) return false;
    const daysLeft = (new Date(o.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return daysLeft >= 0 && daysLeft <= 3;
  }).length;
  const mrrUSD = organizations
    .filter((o) => o.subscriptionStatus === "active")
    .reduce((sum, o) => sum + (getPlan(o.plan)?.priceUSD ?? 0), 0);
  const planDistribution = PLANS.map((p) => ({
    planId: p.id,
    count: organizations.filter((o) => o.plan === p.id).length,
  }));
  const orgSummaries = await listOrgSummaries();
  const totalCustomers = orgSummaries.reduce((sum, o) => sum + o.customerCount, 0);
  const activeCustomers = orgSummaries.reduce((sum, o) => sum + o.activeCustomerCount, 0);

  return {
    totalOrgs: organizations.length,
    trialingCount: byStatus("trialing"),
    activeCount: byStatus("active"),
    pastDueCount: byStatus("past_due"),
    canceledCount: byStatus("canceled"),
    trialsEndingSoon,
    mrrUSD,
    planDistribution,
    totalCustomers,
    activeCustomers,
  };
}

export async function adminChangePlan(organizationId: string, planId: PlanId): Promise<Organization> {
  const { data, error } = await db().from("organizations").update({ plan: planId }).eq("id", organizationId).select().single();
  return mapOrganization(must(data, error, "Organización no encontrada"));
}

export async function adminSetSubscriptionStatus(organizationId: string, status: SubscriptionStatus): Promise<Organization> {
  const { data, error } = await db().from("organizations").update({ subscription_status: status }).eq("id", organizationId).select().single();
  return mapOrganization(must(data, error, "Organización no encontrada"));
}

// ---------------------------------------------------------------------------
// Billing / acceso por plan
// ---------------------------------------------------------------------------

export async function listBillingInvoices(organizationId: string): Promise<BillingInvoice[]> {
  const { data, error } = await db().from("billing_invoices").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapBillingInvoice);
}

export type AccessState =
  | { blocked: false; trialDaysLeft?: number }
  | { blocked: true; reason: "trial_expired" | "canceled" | "past_due" };

export async function computeAccessState(organizationId: string): Promise<AccessState> {
  const org = await getOrganizationById(organizationId);
  if (!org) return { blocked: true, reason: "canceled" };
  if (org.subscriptionStatus === "canceled") return { blocked: true, reason: "canceled" };
  if (org.subscriptionStatus === "past_due") return { blocked: true, reason: "past_due" };

  if (org.subscriptionStatus === "trialing") {
    const trialEndsAt = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
    if (trialEndsAt && trialEndsAt.getTime() < Date.now()) return { blocked: true, reason: "trial_expired" };
    const daysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : undefined;
    return { blocked: false, trialDaysLeft: daysLeft };
  }

  return { blocked: false };
}

export async function hasFeatureAccess(organizationId: string, group: PlanFeatureGroup): Promise<boolean> {
  const org = await getOrganizationById(organizationId);
  const plan = org ? getPlan(org.plan) : undefined;
  return plan ? plan.featureGroups.includes(group) : false;
}

// ---------------------------------------------------------------------------
// Empleados
// ---------------------------------------------------------------------------

export async function listEmployees(organizationId: string): Promise<Employee[]> {
  const { data, error } = await db().from("employees").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapEmployee);
}

export async function getEmployeeById(organizationId: string, employeeId: string): Promise<Employee | undefined> {
  const { data } = await db().from("employees").select("*").eq("id", employeeId).eq("organization_id", organizationId).maybeSingle();
  return data ? mapEmployee(data) : undefined;
}

export async function addEmployee(organizationId: string, actorEmployeeId: string, input: { name: string; email: string; role: EmployeeRole; password: string }): Promise<Employee> {
  const { data: authUser, error: authError } = await db().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (authError) {
    throw new Error(authError.message.includes("already been registered") ? "Ya existe un usuario con ese email" : authError.message);
  }

  const { data, error } = await db()
    .from("employees")
    .insert({ organization_id: organizationId, user_id: authUser.user.id, name: input.name, email: input.email, role: input.role })
    .select()
    .single();
  if (error) {
    await db().auth.admin.deleteUser(authUser.user.id);
    throw error;
  }
  const employee = mapEmployee(data);
  await logAudit(organizationId, actorEmployeeId, "Empleado agregado", `${employee.name} (${employee.role})`);
  return employee;
}

export async function updateEmployeeRole(organizationId: string, actorEmployeeId: string, employeeId: string, role: EmployeeRole): Promise<Employee> {
  const { data, error } = await db().from("employees").update({ role }).eq("id", employeeId).eq("organization_id", organizationId).select().single();
  const employee = mapEmployee(must(data, error, "Empleado no encontrado"));
  await logAudit(organizationId, actorEmployeeId, "Rol actualizado", `${employee.name} ahora es ${role}`);
  return employee;
}

export async function setEmployeeActive(organizationId: string, actorEmployeeId: string, employeeId: string, active: boolean): Promise<Employee> {
  const { data, error } = await db().from("employees").update({ active }).eq("id", employeeId).eq("organization_id", organizationId).select().single();
  const employee = mapEmployee(must(data, error, "Empleado no encontrado"));
  await logAudit(organizationId, actorEmployeeId, active ? "Empleado reactivado" : "Empleado desactivado", employee.name);
  return employee;
}

// ---------------------------------------------------------------------------
// Canchas, clientes, reservas
// ---------------------------------------------------------------------------

const COURT_SELECT = "*, court_price_rules(*)";
const BOOKING_SELECT = "*, booking_payments(*)";

export async function listCourts(organizationId: string): Promise<Court[]> {
  const { data, error } = await db().from("courts").select(COURT_SELECT).eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapCourt);
}

export async function getCourt(organizationId: string, courtId: string): Promise<Court | undefined> {
  const { data } = await db().from("courts").select(COURT_SELECT).eq("id", courtId).eq("organization_id", organizationId).maybeSingle();
  return data ? mapCourt(data) : undefined;
}

export async function listCustomers(organizationId: string): Promise<Customer[]> {
  const { data, error } = await db().from("customers").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapCustomer);
}

export async function getCustomer(organizationId: string, customerId: string): Promise<Customer | undefined> {
  const { data } = await db().from("customers").select("*").eq("id", customerId).eq("organization_id", organizationId).maybeSingle();
  return data ? mapCustomer(data) : undefined;
}

export async function listBookings(organizationId: string): Promise<Booking[]> {
  const { data, error } = await db().from("bookings").select(BOOKING_SELECT).eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapBooking);
}

export async function listBookingsForDate(organizationId: string, dateISO: string): Promise<Booking[]> {
  const { data, error } = await db().from("bookings").select(BOOKING_SELECT).eq("organization_id", organizationId).eq("date", dateISO);
  if (error) throw error;
  return (data ?? []).map(mapBooking);
}

export async function listBookingsForCourtAndDate(organizationId: string, courtId: string, dateISO: string): Promise<Booking[]> {
  const { data, error } = await db().from("bookings").select(BOOKING_SELECT)
    .eq("organization_id", organizationId).eq("court_id", courtId).eq("date", dateISO);
  if (error) throw error;
  return (data ?? []).map(mapBooking);
}

export async function listBookingsForCustomer(organizationId: string, customerId: string): Promise<Booking[]> {
  const { data, error } = await db().from("bookings").select(BOOKING_SELECT)
    .eq("organization_id", organizationId).eq("customer_id", customerId);
  if (error) throw error;
  return (data ?? []).map(mapBooking).sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1));
}

export async function getBooking(organizationId: string, bookingId: string): Promise<Booking | undefined> {
  const { data } = await db().from("bookings").select(BOOKING_SELECT).eq("id", bookingId).eq("organization_id", organizationId).maybeSingle();
  return data ? mapBooking(data) : undefined;
}

export async function getSlotsForCourt(organizationId: string, courtId: string, dateISO: string) {
  const court = await getCourt(organizationId, courtId);
  if (!court) return [];

  const [orgBookings, orgPromotions] = await Promise.all([
    listBookings(organizationId),
    listPromotions(organizationId),
  ]);

  return generateSlots(court, dateISO, orgBookings).map((slot) => {
    const promotion = findApplicablePromotion(orgPromotions, court, dateISO, slot.startTime);
    const { finalPrice, discountLabel } = applyPromotion(slot.basePrice, promotion);
    return { ...slot, price: finalPrice, discountLabel };
  });
}

function listSlotStarts(court: Court, dateISO: string): string[] {
  if (!court.daysOpen.includes(dayOfWeek(dateISO))) return [];
  const open = timeToMinutes(court.openTime);
  const close = timeToMinutes(court.closeTime);
  const starts: string[] = [];
  for (let t = open; t + court.slotMinutes <= close; t += court.slotMinutes) {
    starts.push(minutesToTime(t));
  }
  return starts;
}

export async function isSlotAvailable(organizationId: string, courtId: string, date: string, startTime: string): Promise<boolean> {
  const { data, error } = await db()
    .from("bookings")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("court_id", courtId)
    .eq("date", date)
    .eq("start_time", startTime);
  if (error) throw error;
  return !(data ?? []).some((b: { status: BookingStatus }) => BLOCKING_STATUSES.has(b.status));
}

export async function createPendingBooking(organizationId: string, input: {
  courtId: string;
  customerId: string;
  date: string;
  startTime: string;
  recurringGroupId?: string;
}): Promise<Booking> {
  const court = await getCourt(organizationId, input.courtId);
  if (!court) throw new Error("Cancha no encontrada");
  if (!(await isSlotAvailable(organizationId, input.courtId, input.date, input.startTime))) {
    throw new Error("Ese horario ya no está disponible");
  }
  const org = await getOrganizationById(organizationId);
  if (!org) throw new Error("Organización no encontrada");

  const endMinutes = timeToMinutes(input.startTime) + court.slotMinutes;
  const basePrice = resolveSlotPrice(court, input.date, input.startTime);
  const orgPromotions = await listPromotions(organizationId);
  const promotion = findApplicablePromotion(orgPromotions, court, input.date, input.startTime);
  const { finalPrice, discountLabel } = applyPromotion(basePrice, promotion);
  const { depositAmount, balanceAmount } = computeDeposit(finalPrice, org);

  const { data, error } = await db()
    .from("bookings")
    .insert({
      organization_id: organizationId,
      court_id: input.courtId,
      customer_id: input.customerId,
      date: input.date,
      start_time: input.startTime,
      end_time: minutesToTime(endMinutes),
      total_price: finalPrice,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      status: "pendiente_pago",
      recurring_group_id: input.recurringGroupId,
      discount_label: discountLabel,
    })
    .select(BOOKING_SELECT)
    .single();
  must(data, error);
  return mapBooking(data);
}

export async function payDeposit(organizationId: string, bookingId: string, method: BookingPayment["method"] = "mercado_pago"): Promise<Booking> {
  const booking = await getBooking(organizationId, bookingId);
  if (!booking) throw new Error("Reserva no encontrada");

  const { error: payError } = await db().from("booking_payments").insert({
    booking_id: bookingId,
    concept: "sena",
    amount: booking.depositAmount,
    method,
    status: "aprobado",
  });
  if (payError) throw payError;

  const { data, error } = await db().from("bookings").update({ status: "sena_pagada" }).eq("id", bookingId).select(BOOKING_SELECT).single();
  must(data, error);
  const updated = mapBooking(data);

  await awardLoyaltyPoints(booking.customerId, booking.depositAmount);
  const court = await getCourt(organizationId, booking.courtId);
  await notify(
    organizationId,
    booking.customerId,
    "reserva_confirmada",
    `Tu reserva quedó confirmada para el ${booking.date} a las ${booking.startTime} en ${court?.name ?? "tu cancha"}.`
  );

  return updated;
}

export async function collectBalance(organizationId: string, employeeId: string, bookingId: string, method: BookingPayment["method"]): Promise<Booking> {
  const booking = await getBooking(organizationId, bookingId);
  if (!booking) throw new Error("Reserva no encontrada");

  const { error: payError } = await db().from("booking_payments").insert({
    booking_id: bookingId,
    concept: "saldo",
    amount: booking.balanceAmount,
    method,
    status: "aprobado",
  });
  if (payError) throw payError;

  const { data, error } = await db().from("bookings").update({ status: "confirmada" }).eq("id", bookingId).select(BOOKING_SELECT).single();
  must(data, error);
  const updated = mapBooking(data);

  const openSession = await getOpenCashSession(organizationId);
  if (openSession) {
    await db().from("cash_movements").insert({
      organization_id: organizationId,
      cash_session_id: openSession.id,
      type: "cobro_reserva",
      amount: booking.balanceAmount,
      method,
      concept: `Saldo reserva #${booking.id.slice(-6)}`,
      employee_id: employeeId,
    });
  }
  await logAudit(organizationId, employeeId, "Cobro de saldo", `Reserva #${booking.id.slice(-6)} — ${formatArs(booking.balanceAmount)} (${method})`);
  await awardLoyaltyPoints(booking.customerId, booking.balanceAmount);

  return updated;
}

const AUDITED_STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  cancelada: "Cancelación de reserva",
  no_show: "No show registrado",
  confirmada: "Reserva confirmada",
  en_curso: "Turno iniciado",
  finalizada: "Turno finalizado",
};

export async function updateBookingStatus(organizationId: string, employeeId: string, bookingId: string, status: BookingStatus): Promise<Booking> {
  const existing = await getBooking(organizationId, bookingId);
  if (!existing) throw new Error("Reserva no encontrada");

  const { data, error } = await db().from("bookings").update({ status }).eq("id", bookingId).select(BOOKING_SELECT).single();
  must(data, error);
  const booking = mapBooking(data);

  const label = AUDITED_STATUS_LABELS[status];
  if (label) {
    await logAudit(organizationId, employeeId, label, `Reserva #${booking.id.slice(-6)}`);
  }

  if (status === "cancelada") {
    const court = await getCourt(organizationId, booking.courtId);
    await notify(
      organizationId,
      booking.customerId,
      "cancelacion",
      `Se canceló tu reserva del ${booking.date} a las ${booking.startTime} en ${court?.name ?? "la cancha"}.`
    );
    await notifyWaitlist(organizationId, booking.courtId, booking.date, booking.startTime);
  }

  return booking;
}

async function notifyWaitlist(organizationId: string, courtId: string, date: string, startTime: string) {
  const court = await getCourt(organizationId, courtId);
  const { data: waiting, error } = await db()
    .from("waitlist_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("court_id", courtId)
    .eq("date", date)
    .eq("start_time", startTime)
    .eq("status", "esperando");
  if (error) throw error;

  for (const entry of waiting ?? []) {
    await db().from("waitlist_entries").update({ status: "notificado", notified_at: new Date().toISOString() }).eq("id", entry.id);
    await notify(
      organizationId,
      entry.customer_id,
      "lista_espera_liberada",
      `¡Se liberó tu horario en ${court?.name ?? "la cancha"} el ${date} a las ${startTime}! Reservalo antes de que se lo lleve otro.`
    );
  }
}

export async function createRecurringBooking(organizationId: string, input: {
  courtId: string;
  customerId: string;
  startDate: string;
  startTime: string;
  weeks: number;
}) {
  const groupId = `rec_${Date.now()}`;
  const created: Booking[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < input.weeks; i++) {
    const date = addDaysISO(input.startDate, i * 7);
    if (!(await isSlotAvailable(organizationId, input.courtId, date, input.startTime))) {
      skipped.push(date);
      continue;
    }
    const booking = await createPendingBooking(organizationId, {
      courtId: input.courtId,
      customerId: input.customerId,
      date,
      startTime: input.startTime,
      recurringGroupId: groupId,
    });
    await payDeposit(organizationId, booking.id, "mercado_pago");
    created.push(booking);
  }

  return { created, skipped };
}

export async function joinWaitlist(organizationId: string, customerId: string, courtId: string, date: string, startTime: string): Promise<WaitlistEntry> {
  const { data: existing } = await db()
    .from("waitlist_entries")
    .select("*")
    .eq("organization_id", organizationId).eq("customer_id", customerId).eq("court_id", courtId)
    .eq("date", date).eq("start_time", startTime).eq("status", "esperando")
    .maybeSingle();
  if (existing) return mapWaitlistEntry(existing);

  const { data, error } = await db()
    .from("waitlist_entries")
    .insert({ organization_id: organizationId, customer_id: customerId, court_id: courtId, date, start_time: startTime })
    .select()
    .single();
  must(data, error);
  return mapWaitlistEntry(data);
}

export async function listWaitlistForCustomer(organizationId: string, customerId: string): Promise<WaitlistEntry[]> {
  const { data, error } = await db().from("waitlist_entries").select("*").eq("organization_id", organizationId).eq("customer_id", customerId);
  if (error) throw error;
  return (data ?? []).map(mapWaitlistEntry);
}

export async function listWaitlistForSlot(organizationId: string, courtId: string, date: string, startTime: string): Promise<WaitlistEntry[]> {
  const { data, error } = await db().from("waitlist_entries").select("*")
    .eq("organization_id", organizationId).eq("court_id", courtId).eq("date", date).eq("start_time", startTime).eq("status", "esperando");
  if (error) throw error;
  return (data ?? []).map(mapWaitlistEntry);
}

// ---------------------------------------------------------------------------
// Productos, inventario, caja/POS, gastos, auditoría
// ---------------------------------------------------------------------------

export async function listProductCategories(organizationId: string): Promise<ProductCategory[]> {
  const { data, error } = await db().from("product_categories").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapProductCategory);
}

export async function listProducts(organizationId: string): Promise<Product[]> {
  const { data, error } = await db().from("products").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function getProduct(organizationId: string, productId: string): Promise<Product | undefined> {
  const { data } = await db().from("products").select("*").eq("id", productId).eq("organization_id", organizationId).maybeSingle();
  return data ? mapProduct(data) : undefined;
}

export async function listLowStockProducts(organizationId: string): Promise<Product[]> {
  const products = await listProducts(organizationId);
  return products.filter((p) => p.active && p.stock <= p.minStock);
}

export async function adjustStock(organizationId: string, employeeId: string, productId: string, delta: number, reason: string): Promise<Product> {
  const product = await getProduct(organizationId, productId);
  if (!product) throw new Error("Producto no encontrado");
  const newStock = Math.max(0, product.stock + delta);
  const { data, error } = await db().from("products").update({ stock: newStock }).eq("id", productId).select().single();
  must(data, error);
  await logAudit(organizationId, employeeId, "Ajuste de stock", `${product.name}: ${delta > 0 ? "+" : ""}${delta} (${reason})`);
  return mapProduct(data);
}

export async function listExpenses(organizationId: string): Promise<Expense[]> {
  const { data, error } = await db().from("expenses").select("*").eq("organization_id", organizationId).order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapExpense);
}

export async function listExpensesForMonth(organizationId: string, yearMonth: string): Promise<Expense[]> {
  const expenses = await listExpenses(organizationId);
  return expenses.filter((e) => e.date.startsWith(yearMonth));
}

export async function addExpense(organizationId: string, input: {
  employeeId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}): Promise<Expense> {
  const { data, error } = await db().from("expenses").insert({
    organization_id: organizationId,
    employee_id: input.employeeId,
    category: input.category,
    description: input.description,
    amount: input.amount,
    date: input.date,
  }).select().single();
  must(data, error);
  const expense = mapExpense(data);

  const openSession = await getOpenCashSession(organizationId);
  if (openSession && expense.date === todayISO()) {
    await db().from("cash_movements").insert({
      organization_id: organizationId,
      cash_session_id: openSession.id,
      type: "gasto",
      amount: -expense.amount,
      method: "efectivo",
      concept: expense.description,
      employee_id: input.employeeId,
    });
  }

  await logAudit(organizationId, input.employeeId, "Gasto registrado", `${expense.description} — ${formatArs(expense.amount)}`);
  return expense;
}

export async function getOpenCashSession(organizationId: string): Promise<CashRegisterSession | undefined> {
  const { data } = await db().from("cash_registers").select("*").eq("organization_id", organizationId).eq("status", "abierta").maybeSingle();
  return data ? mapCashSession(data) : undefined;
}

export async function listCashSessions(organizationId: string): Promise<CashRegisterSession[]> {
  const { data, error } = await db().from("cash_registers").select("*").eq("organization_id", organizationId).order("opened_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCashSession);
}

export async function getCashSession(organizationId: string, sessionId: string): Promise<CashRegisterSession | undefined> {
  const { data } = await db().from("cash_registers").select("*").eq("id", sessionId).eq("organization_id", organizationId).maybeSingle();
  return data ? mapCashSession(data) : undefined;
}

export async function listCashMovements(organizationId: string, sessionId: string): Promise<CashMovement[]> {
  const { data, error } = await db().from("cash_movements").select("*")
    .eq("organization_id", organizationId).eq("cash_session_id", sessionId).order("created_at");
  if (error) throw error;
  return (data ?? []).map(mapCashMovement);
}

export async function openCashSession(organizationId: string, employeeId: string, openingAmount: number): Promise<CashRegisterSession> {
  if (await getOpenCashSession(organizationId)) throw new Error("Ya hay una caja abierta");
  const { data, error } = await db().from("cash_registers").insert({
    organization_id: organizationId, employee_id: employeeId, status: "abierta", opening_amount: openingAmount,
  }).select().single();
  must(data, error);
  await logAudit(organizationId, employeeId, "Apertura de caja", `Monto inicial ${formatArs(openingAmount)}`);
  return mapCashSession(data);
}

export async function closeCashSession(organizationId: string, employeeId: string, sessionId: string, countedAmount: number): Promise<CashRegisterSession> {
  const { data, error } = await db().from("cash_registers").update({
    status: "cerrada", closing_counted_amount: countedAmount, closed_at: new Date().toISOString(),
  }).eq("id", sessionId).eq("organization_id", organizationId).select().single();
  const session = mapCashSession(must(data, error, "Caja no encontrada"));
  await logAudit(organizationId, employeeId, "Cierre de caja", `Caja cerrada con ${formatArs(countedAmount)} contados`);
  return session;
}

export async function listSales(organizationId: string): Promise<Sale[]> {
  const { data, error } = await db().from("sales").select("*, sale_items(*)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSale);
}

export async function listSalesForSession(organizationId: string, sessionId: string): Promise<Sale[]> {
  const { data, error } = await db().from("sales").select("*, sale_items(*)").eq("organization_id", organizationId).eq("cash_session_id", sessionId);
  if (error) throw error;
  return (data ?? []).map(mapSale);
}

export async function createSale(organizationId: string, input: {
  employeeId: string;
  items: { productId: string; quantity: number }[];
  method: PaymentMethod;
}): Promise<Sale> {
  const openSession = await getOpenCashSession(organizationId);
  if (!openSession) throw new Error("No hay una caja abierta");
  if (input.items.length === 0) throw new Error("La venta no tiene productos");

  const items: SaleItem[] = [];
  for (const { productId, quantity } of input.items) {
    const product = await getProduct(organizationId, productId);
    if (!product) throw new Error("Producto no encontrado");
    if (product.stock < quantity) throw new Error(`Stock insuficiente de ${product.name}`);
    items.push({ productId, name: product.name, quantity, unitPrice: product.price });
    await db().from("products").update({ stock: product.stock - quantity }).eq("id", productId);
  }

  const total = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const { data: saleRow, error } = await db().from("sales").insert({
    organization_id: organizationId, cash_session_id: openSession.id, employee_id: input.employeeId, total, method: input.method,
  }).select().single();
  must(saleRow, error);

  await db().from("sale_items").insert(
    items.map((it) => ({ sale_id: saleRow.id, product_id: it.productId, name: it.name, quantity: it.quantity, unit_price: it.unitPrice }))
  );

  await db().from("cash_movements").insert({
    organization_id: organizationId,
    cash_session_id: openSession.id,
    type: "venta",
    amount: total,
    method: input.method,
    concept: items.map((it) => `${it.quantity}x ${it.name}`).join(", "),
    employee_id: input.employeeId,
    created_at: saleRow.created_at,
  });

  await logAudit(organizationId, input.employeeId, "Venta registrada", `${formatArs(total)} — ${items.map((it) => it.name).join(", ")}`);
  return { ...mapSale(saleRow), items };
}

export async function listAuditLog(organizationId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await db().from("audit_logs").select("*, employees(name)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAuditLog);
}

async function logAudit(organizationId: string, employeeId: string | null, action: string, detail: string) {
  await db().from("audit_logs").insert({ organization_id: organizationId, employee_id: employeeId, action, detail });
}

// ---------------------------------------------------------------------------
// Promociones, fidelización, lista de espera, notificaciones
// ---------------------------------------------------------------------------

export async function listPromotions(organizationId: string): Promise<Promotion[]> {
  const { data, error } = await db().from("promotions").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapPromotion);
}

export async function createPromotion(organizationId: string, actorEmployeeId: string, input: Omit<Promotion, "id" | "organizationId">): Promise<Promotion> {
  const { data, error } = await db().from("promotions").insert({
    organization_id: organizationId,
    label: input.label,
    discount_percentage: input.discountPercentage,
    days_of_week: input.daysOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    sports: input.sports,
    active: input.active,
  }).select().single();
  must(data, error);
  const promotion = mapPromotion(data);
  await logAudit(organizationId, actorEmployeeId, "Promoción creada", `${promotion.label} (-${Math.round(promotion.discountPercentage * 100)}%)`);
  return promotion;
}

export async function setPromotionActive(organizationId: string, actorEmployeeId: string, promotionId: string, active: boolean): Promise<Promotion> {
  const { data, error } = await db().from("promotions").update({ active }).eq("id", promotionId).eq("organization_id", organizationId).select().single();
  const promotion = mapPromotion(must(data, error, "Promoción no encontrada"));
  await logAudit(organizationId, actorEmployeeId, active ? "Promoción activada" : "Promoción desactivada", promotion.label);
  return promotion;
}

export async function listLoyaltyRewards(organizationId: string): Promise<LoyaltyReward[]> {
  const { data, error } = await db().from("loyalty_rewards").select("*").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []).map(mapLoyaltyReward);
}

export async function listLoyaltyRedemptions(organizationId: string, customerId: string): Promise<LoyaltyRedemption[]> {
  const { data, error } = await db().from("loyalty_redemptions").select("*, loyalty_rewards(label)")
    .eq("organization_id", organizationId).eq("customer_id", customerId);
  if (error) throw error;
  return (data ?? []).map(mapLoyaltyRedemption);
}

async function awardLoyaltyPoints(customerId: string, amountSpent: number) {
  const { data: customer } = await db().from("customers").select("loyalty_points").eq("id", customerId).maybeSingle();
  if (!customer) return;
  await db().from("customers").update({ loyalty_points: customer.loyalty_points + Math.floor(amountSpent / 100) }).eq("id", customerId);
}

export async function redeemLoyaltyReward(organizationId: string, customerId: string, rewardId: string): Promise<LoyaltyRedemption> {
  const { data: customer } = await db().from("customers").select("*").eq("id", customerId).eq("organization_id", organizationId).maybeSingle();
  if (!customer) throw new Error("Cliente no encontrado");
  const { data: reward } = await db().from("loyalty_rewards").select("*").eq("id", rewardId).maybeSingle();
  if (!reward) throw new Error("Beneficio no encontrado");
  if (customer.loyalty_points < reward.points_cost) throw new Error("No tenés puntos suficientes");

  await db().from("customers").update({ loyalty_points: customer.loyalty_points - reward.points_cost }).eq("id", customerId);

  const { data, error } = await db().from("loyalty_redemptions").insert({
    organization_id: organizationId, customer_id: customerId, reward_id: rewardId, points_spent: reward.points_cost,
  }).select("*, loyalty_rewards(label)").single();
  must(data, error);
  await logAudit(organizationId, null, "Canje de puntos", `${customer.name} canjeó "${reward.label}"`);
  return mapLoyaltyRedemption(data);
}

export async function listNotifications(organizationId: string): Promise<NotificationEntry[]> {
  const { data, error } = await db().from("notifications").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function listNotificationsForCustomer(organizationId: string, customerId: string): Promise<NotificationEntry[]> {
  const { data, error } = await db().from("notifications").select("*")
    .eq("organization_id", organizationId).eq("customer_id", customerId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

async function notify(organizationId: string, customerId: string, kind: NotificationKind, message: string, channel: NotificationChannel = "whatsapp") {
  await db().from("notifications").insert({ organization_id: organizationId, customer_id: customerId, channel, kind, message });
}

// ---------------------------------------------------------------------------
// Torneos y ranking
// ---------------------------------------------------------------------------

export async function listTournaments(organizationId: string): Promise<Tournament[]> {
  const { data, error } = await db().from("tournaments").select("*").eq("organization_id", organizationId).order("date");
  if (error) throw error;
  return (data ?? []).map(mapTournament);
}

export async function getTournament(organizationId: string, tournamentId: string): Promise<Tournament | undefined> {
  const { data } = await db().from("tournaments").select("*").eq("id", tournamentId).eq("organization_id", organizationId).maybeSingle();
  return data ? mapTournament(data) : undefined;
}

export async function listTeamsForTournament(tournamentId: string): Promise<TournamentTeam[]> {
  const { data, error } = await db().from("tournament_teams").select("*").eq("tournament_id", tournamentId);
  if (error) throw error;
  return (data ?? []).map(mapTournamentTeam);
}

export async function getTeam(teamId: string): Promise<TournamentTeam | undefined> {
  const { data } = await db().from("tournament_teams").select("*").eq("id", teamId).maybeSingle();
  return data ? mapTournamentTeam(data) : undefined;
}

export async function listMatchesForTournament(tournamentId: string): Promise<TournamentMatch[]> {
  const { data, error } = await db().from("tournament_matches").select("*").eq("tournament_id", tournamentId).order("round").order("match_index");
  if (error) throw error;
  return (data ?? []).map(mapTournamentMatch);
}

export async function createTournament(
  organizationId: string,
  actorEmployeeId: string,
  input: Omit<Tournament, "id" | "organizationId" | "status" | "createdAt">
): Promise<Tournament> {
  const { data, error } = await db().from("tournaments").insert({
    organization_id: organizationId,
    name: input.name,
    sport: input.sport,
    category: input.category,
    date: input.date,
    max_teams: input.maxTeams,
    entry_fee: input.entryFee,
    prize: input.prize,
    status: "inscripcion",
  }).select().single();
  must(data, error);
  const tournament = mapTournament(data);
  await logAudit(organizationId, actorEmployeeId, "Torneo creado", tournament.name);
  return tournament;
}

export async function registerTeam(organizationId: string, input: {
  tournamentId: string;
  name: string;
  playerNames: string[];
  customerId?: string;
}): Promise<TournamentTeam> {
  const tournament = await getTournament(organizationId, input.tournamentId);
  if (!tournament) throw new Error("Torneo no encontrado");
  if (tournament.status !== "inscripcion") throw new Error("La inscripción ya cerró");

  const currentTeams = await listTeamsForTournament(input.tournamentId);
  if (currentTeams.length >= tournament.maxTeams) throw new Error("No hay cupos disponibles");

  const { data, error } = await db().from("tournament_teams").insert({
    tournament_id: input.tournamentId,
    name: input.name,
    player_names: input.playerNames,
    customer_id: input.customerId,
    paid_entry: true,
  }).select().single();
  must(data, error);
  const team = mapTournamentTeam(data);
  await logAudit(organizationId, null, "Equipo inscripto", `${team.name} en ${tournament.name}`);

  if (input.customerId) {
    await notify(organizationId, input.customerId, "torneo_inscripcion", `Inscribimos a "${team.name}" en ${tournament.name}. ¡Nos vemos el ${tournament.date}!`);
  }
  return team;
}

function bracketSize(teamCount: number): number {
  let size = 2;
  while (size < teamCount) size *= 2;
  return size;
}

async function propagateWinner(tournamentId: string, match: TournamentMatch) {
  if (!match.winnerTeamId) return;
  const nextRound = match.round + 1;
  const nextIndex = Math.floor(match.matchIndex / 2);
  const { data: nextMatch } = await db().from("tournament_matches").select("*")
    .eq("tournament_id", tournamentId).eq("round", nextRound).eq("match_index", nextIndex).maybeSingle();
  if (!nextMatch) return; // era la final
  const field = match.matchIndex % 2 === 0 ? "team_a_id" : "team_b_id";
  await db().from("tournament_matches").update({ [field]: match.winnerTeamId }).eq("id", nextMatch.id);
}

export async function generateBracket(organizationId: string, actorEmployeeId: string, tournamentId: string): Promise<TournamentMatch[]> {
  const tournament = await getTournament(organizationId, tournamentId);
  if (!tournament) throw new Error("Torneo no encontrado");
  const teams = await listTeamsForTournament(tournamentId);
  if (teams.length < 2) throw new Error("Necesitás al menos 2 equipos para generar el cuadro");
  const existingMatches = await listMatchesForTournament(tournamentId);
  if (existingMatches.length > 0) throw new Error("El cuadro ya fue generado");

  const size = bracketSize(teams.length);
  const rounds = Math.log2(size);
  const slots: (string | undefined)[] = teams.map((t) => t.id);
  while (slots.length < size) slots.push(undefined);

  const round1Rows: Record<string, unknown>[] = [];
  for (let i = 0; i < size / 2; i++) {
    const teamAId = slots[i * 2];
    const teamBId = slots[i * 2 + 1];
    const onlyOne = (teamAId && !teamBId) || (!teamAId && teamBId);
    round1Rows.push({
      tournament_id: tournamentId, round: 1, match_index: i,
      team_a_id: teamAId ?? null, team_b_id: teamBId ?? null,
      status: onlyOne ? "bye" : "pendiente",
      winner_team_id: onlyOne ? (teamAId ?? teamBId) : null,
    });
  }
  const otherRoundRows: Record<string, unknown>[] = [];
  let prevRoundCount = size / 2;
  for (let r = 2; r <= rounds; r++) {
    const count = prevRoundCount / 2;
    for (let i = 0; i < count; i++) otherRoundRows.push({ tournament_id: tournamentId, round: r, match_index: i, status: "pendiente" });
    prevRoundCount = count;
  }

  const { data: inserted, error } = await db().from("tournament_matches").insert([...round1Rows, ...otherRoundRows]).select();
  if (error) throw error;
  const allMatches = (inserted ?? []).map(mapTournamentMatch);

  for (const m of allMatches.filter((m) => m.status === "bye")) {
    await propagateWinner(tournamentId, m);
  }

  await db().from("tournaments").update({ status: "en_curso" }).eq("id", tournamentId);
  await logAudit(organizationId, actorEmployeeId, "Cuadro generado", `${tournament.name} — ${teams.length} equipos`);
  return listMatchesForTournament(tournamentId);
}

export async function recordMatchResult(organizationId: string, actorEmployeeId: string, matchId: string, winnerTeamId: string, scoreLabel?: string): Promise<TournamentMatch> {
  const { data: matchRow } = await db().from("tournament_matches").select("*").eq("id", matchId).maybeSingle();
  if (!matchRow) throw new Error("Partido no encontrado");
  const match = mapTournamentMatch(matchRow);
  const tournament = await getTournament(organizationId, match.tournamentId);
  if (!tournament) throw new Error("Torneo no encontrado");
  if (!match.teamAId || !match.teamBId) throw new Error("Todavía faltan equipos para este partido");
  if (winnerTeamId !== match.teamAId && winnerTeamId !== match.teamBId) throw new Error("Equipo inválido");

  const { data, error } = await db().from("tournament_matches").update({
    winner_team_id: winnerTeamId, score_label: scoreLabel, status: "jugado",
  }).eq("id", matchId).select().single();
  must(data, error);
  const updated = mapTournamentMatch(data);
  await propagateWinner(match.tournamentId, updated);

  const { count: nextRoundCount } = await db().from("tournament_matches").select("id", { count: "exact", head: true })
    .eq("tournament_id", match.tournamentId).eq("round", match.round + 1);
  if (!nextRoundCount) await db().from("tournaments").update({ status: "finalizado" }).eq("id", tournament.id);

  const winner = await getTeam(winnerTeamId);
  await logAudit(organizationId, actorEmployeeId, "Resultado cargado", `${winner?.name ?? winnerTeamId} ganó (ronda ${match.round})`);
  return updated;
}

export async function computeRanking(organizationId: string): Promise<RankingEntry[]> {
  const tournaments = await listTournaments(organizationId);
  const allMatches = (await Promise.all(tournaments.map((t) => listMatchesForTournament(t.id)))).flat();
  const allTeams = (await Promise.all(tournaments.map((t) => listTeamsForTournament(t.id)))).flat();

  const roundsByTournament = new Map<string, number>();
  for (const m of allMatches) {
    roundsByTournament.set(m.tournamentId, Math.max(roundsByTournament.get(m.tournamentId) ?? 0, m.round));
  }

  const pointsMap = new Map<string, RankingEntry>();
  for (const m of allMatches) {
    if (m.status !== "jugado" || !m.winnerTeamId) continue;
    const team = allTeams.find((t) => t.id === m.winnerTeamId);
    if (!team) continue;
    const isFinal = m.round === roundsByTournament.get(m.tournamentId);

    for (const player of team.playerNames) {
      const entry = pointsMap.get(player) ?? { playerName: player, points: 0, wins: 0, titles: 0 };
      entry.points += isFinal ? 400 : 100;
      entry.wins += 1;
      if (isFinal) entry.titles += 1;
      pointsMap.set(player, entry);
    }
  }
  return [...pointsMap.values()].sort((a, b) => b.points - a.points);
}

// ---------------------------------------------------------------------------
// Analítica (Fase 4) — vistas derivadas de bookings/expenses/sales/torneos.
// ---------------------------------------------------------------------------

const HOUR_BANDS = [
  { label: "08-12", start: 8 * 60, end: 12 * 60 },
  { label: "12-17", start: 12 * 60, end: 17 * 60 },
  { label: "17-20", start: 17 * 60, end: 20 * 60 },
  { label: "20-23", start: 20 * 60, end: 23 * 60 },
];

function hourBandFor(startTime: string) {
  const m = timeToMinutes(startTime);
  return HOUR_BANDS.find((b) => m >= b.start && m < b.end) ?? HOUR_BANDS[HOUR_BANDS.length - 1];
}

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const DEMAND_STATUSES = new Set<BookingStatus>([
  "pendiente_pago", "sena_pagada", "confirmada", "en_curso", "finalizada", "no_show",
]);

const ANALYTICS_WINDOW_DAYS = 35;

function historicalDateRange(): string[] {
  const today = todayISO();
  const dates: string[] = [];
  for (let offset = -ANALYTICS_WINDOW_DAYS; offset < 0; offset++) dates.push(addDaysISO(today, offset));
  return dates;
}

function countPossibleSlots(court: Court, dates: string[]): number {
  return dates.reduce((sum, date) => sum + listSlotStarts(court, date).length, 0);
}

export async function computeCourtRevenueRanking(organizationId: string) {
  const dates = new Set(historicalDateRange());
  const [courts, bookings] = await Promise.all([listCourts(organizationId), listBookings(organizationId)]);
  const orgCourts = courts.filter((c) => c.active);
  const historical = bookings.filter((b) => dates.has(b.date) && DEMAND_STATUSES.has(b.status));

  return orgCourts
    .map((court) => {
      const courtBookings = historical.filter((b) => b.courtId === court.id);
      const revenue = courtBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const possible = countPossibleSlots(court, [...dates]);
      return { court, revenue, occupancyPct: possible ? courtBookings.length / possible : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export async function computeHourBandStats(organizationId: string) {
  const dates = new Set(historicalDateRange());
  const [courts, bookings] = await Promise.all([listCourts(organizationId), listBookings(organizationId)]);
  const orgCourts = courts.filter((c) => c.active);
  const historical = bookings.filter((b) => dates.has(b.date) && DEMAND_STATUSES.has(b.status));

  return HOUR_BANDS.map((band) => {
    const inBand = historical.filter((b) => hourBandFor(b.startTime).label === band.label);
    const revenue = inBand.reduce((sum, b) => sum + b.totalPrice, 0);

    let possible = 0;
    for (const court of orgCourts) {
      for (const date of dates) {
        possible += listSlotStarts(court, date).filter((s) => hourBandFor(s).label === band.label).length;
      }
    }
    return { label: band.label, revenue, occupancyPct: possible ? inBand.length / possible : 0 };
  });
}

export async function computeWeekdayStats(organizationId: string) {
  const dates = historicalDateRange();
  const [courts, bookings] = await Promise.all([listCourts(organizationId), listBookings(organizationId)]);
  const orgCourts = courts.filter((c) => c.active);
  const historical = bookings.filter((b) => dates.includes(b.date) && DEMAND_STATUSES.has(b.status));

  return WEEKDAY_LABELS.map((label, dow) => {
    const datesForDow = dates.filter((d) => dayOfWeek(d) === dow);
    const bookingsForDow = historical.filter((b) => datesForDow.includes(b.date));
    let possible = 0;
    for (const court of orgCourts) possible += countPossibleSlots(court, datesForDow);
    return { dow, label, occupancyPct: possible ? bookingsForDow.length / possible : 0 };
  });
}

export interface DemandRecommendation {
  court: Court;
  dow: number;
  dayLabel: string;
  hourBandLabel: string;
  occupancyPct: number;
  sampleSize: number;
}

export async function computeLowDemandRecommendations(organizationId: string, limit = 3): Promise<DemandRecommendation[]> {
  const dates = historicalDateRange();
  const [courts, bookings] = await Promise.all([listCourts(organizationId), listBookings(organizationId)]);
  const orgCourts = courts.filter((c) => c.active);
  const historical = bookings.filter((b) => dates.includes(b.date) && DEMAND_STATUSES.has(b.status));

  const buckets = new Map<string, { court: Court; dow: number; band: string; possible: number; taken: number }>();
  for (const court of orgCourts) {
    for (const date of dates) {
      const dow = dayOfWeek(date);
      for (const start of listSlotStarts(court, date)) {
        const band = hourBandFor(start).label;
        const key = `${court.id}_${dow}_${band}`;
        const bucket = buckets.get(key) ?? { court, dow, band, possible: 0, taken: 0 };
        bucket.possible += 1;
        buckets.set(key, bucket);
      }
    }
  }
  for (const b of historical) {
    const key = `${b.courtId}_${dayOfWeek(b.date)}_${hourBandFor(b.startTime).label}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.taken += 1;
  }

  return [...buckets.values()]
    .filter((b) => b.possible >= 4)
    .map((b) => ({
      court: b.court,
      dow: b.dow,
      dayLabel: WEEKDAY_LABELS[b.dow],
      hourBandLabel: b.band,
      occupancyPct: b.taken / b.possible,
      sampleSize: b.possible,
    }))
    .sort((a, b) => a.occupancyPct - b.occupancyPct)
    .slice(0, limit);
}

export async function computeHighDemandBand(organizationId: string): Promise<DemandRecommendation | undefined> {
  const recs = await computeLowDemandRecommendations(organizationId, 1000);
  if (recs.length === 0) return undefined;
  return [...recs].sort((a, b) => b.occupancyPct - a.occupancyPct)[0];
}

export async function computePaymentMethodTotals(organizationId: string) {
  const [bookings, sales] = await Promise.all([listBookings(organizationId), listSales(organizationId)]);
  const totals = new Map<PaymentMethod, number>();
  for (const b of bookings) {
    for (const p of b.payments) totals.set(p.method, (totals.get(p.method) ?? 0) + p.amount);
  }
  for (const s of sales) {
    totals.set(s.method, (totals.get(s.method) ?? 0) + s.total);
  }
  return [...totals.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}

export async function computeRevenueByCategory(organizationId: string) {
  const [bookings, sales, tournaments] = await Promise.all([
    listBookings(organizationId), listSales(organizationId), listTournaments(organizationId),
  ]);

  const canchas = bookings.reduce((sum, b) => sum + b.payments.reduce((s, p) => s + p.amount, 0), 0);
  const productos = sales.reduce((sum, s) => sum + s.total, 0);
  let torneos = 0;
  for (const t of tournaments) {
    const teams = await listTeamsForTournament(t.id);
    torneos += teams.filter((team) => team.paidEntry).length * t.entryFee;
  }
  return { canchas, productos, torneos, total: canchas + productos + torneos };
}

export async function computeProfitAndLoss(organizationId: string) {
  const [{ total: ingresos }, expenses] = await Promise.all([computeRevenueByCategory(organizationId), listExpenses(organizationId)]);
  const gastos = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { ingresos, gastos, resultado: ingresos - gastos, margin: ingresos ? (ingresos - gastos) / ingresos : 0 };
}

export async function computeDailyRevenue(organizationId: string, days = 14) {
  const today = todayISO();
  const [bookings, sales] = await Promise.all([listBookings(organizationId), listSales(organizationId)]);
  const result: { date: string; canchas: number; productos: number; total: number }[] = [];

  for (let offset = -(days - 1); offset <= 0; offset++) {
    const date = addDaysISO(today, offset);
    const canchas = bookings
      .flatMap((b) => b.payments)
      .filter((p) => p.paidAt.startsWith(date))
      .reduce((sum, p) => sum + p.amount, 0);
    const productos = sales.filter((s) => s.createdAt.startsWith(date)).reduce((sum, s) => sum + s.total, 0);
    result.push({ date, canchas, productos, total: canchas + productos });
  }
  return result;
}

// ---------------------------------------------------------------------------
// SaaS mutations: cambio de plan, facturación de la propia cuenta
// ---------------------------------------------------------------------------

export async function changePlan(organizationId: string, employeeId: string, planId: PlanId): Promise<Organization> {
  const organization = await getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  const previous = organization.plan;
  const { data, error } = await db().from("organizations").update({ plan: planId }).eq("id", organizationId).select().single();
  must(data, error);
  await logAudit(organizationId, employeeId, "Plan cambiado", `${previous} → ${planId}`);
  return mapOrganization(data);
}

export async function activateSubscription(organizationId: string, employeeId: string, billingEmail: string): Promise<Organization> {
  const organization = await getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  const plan = getPlan(organization.plan);
  if (!plan) throw new Error("Plan inválido");

  const currentPeriodEnd = addDaysISO(todayISO(), 30);
  const { data, error } = await db().from("organizations").update({
    subscription_status: "active",
    billing_email: billingEmail,
    trial_ends_at: null,
    current_period_end: currentPeriodEnd,
    mercadopago_subscription_id: organization.mercadopagoSubscriptionId ?? `mp_sub_${Date.now()}`,
  }).eq("id", organizationId).select().single();
  must(data, error);

  await db().from("billing_invoices").insert({
    organization_id: organizationId, plan: plan.id, amount_usd: plan.priceUSD, status: "pagada",
    period_start: todayISO(), period_end: currentPeriodEnd,
  });

  await logAudit(organizationId, employeeId, "Suscripción activada", `Plan ${plan.name} — USD ${plan.priceUSD}/mes`);
  return mapOrganization(data);
}

export async function getOrganizationByMpPreapproval(preapprovalId: string): Promise<Organization | undefined> {
  const { data } = await db().from("organizations").select("*").eq("mercadopago_subscription_id", preapprovalId).maybeSingle();
  return data ? mapOrganization(data) : undefined;
}

const MP_STATUS_TO_SUBSCRIPTION: Record<string, SubscriptionStatus | undefined> = {
  authorized: "active",
  paused: "past_due",
  cancelled: "canceled",
};

// Se llama tanto cuando el dueño vuelve del checkout de Mercado Pago como
// desde el webhook en cada evento posterior de esa misma suscripción — en
// los dos casos el estado real siempre se pide de nuevo a la API de MP
// (mercadopago.ts), nunca se confía en lo que viene del query param o del
// body del webhook.
export async function syncMercadoPagoSubscription(
  organizationId: string,
  preapprovalId: string,
  planId: PlanId | undefined,
  mpStatus: string,
  billingEmail?: string
): Promise<Organization> {
  const status = MP_STATUS_TO_SUBSCRIPTION[mpStatus];
  const update: Record<string, unknown> = { mercadopago_subscription_id: preapprovalId };
  if (planId) update.plan = planId;
  if (billingEmail) update.billing_email = billingEmail;
  if (status) {
    update.subscription_status = status;
    if (status === "active") {
      update.trial_ends_at = null;
      update.current_period_end = addDaysISO(todayISO(), 30);
    }
  }

  const { data, error } = await db().from("organizations").update(update).eq("id", organizationId).select().single();
  must(data, error);

  if (status === "active" && planId) {
    const plan = getPlan(planId);
    if (plan) {
      await db().from("billing_invoices").insert({
        organization_id: organizationId, plan: plan.id, amount_usd: plan.priceUSD, status: "pagada",
        period_start: todayISO(), period_end: addDaysISO(todayISO(), 30),
      });
    }
  }

  return mapOrganization(data);
}

// El dueño vuelve del checkout de Mercado Pago a /admin/plan?preapproval_id=…
// — acá se resuelve a qué plan corresponde ese preapproval_plan_id y se deja
// la suscripción vinculada a esta organización con el estado real de MP.
export async function linkMercadoPagoReturn(organizationId: string, preapprovalId: string): Promise<void> {
  const preapproval = await fetchPreapproval(preapprovalId);
  const plan = preapproval.preapproval_plan_id ? getPlanByMpPreapprovalPlanId(preapproval.preapproval_plan_id) : undefined;
  await syncMercadoPagoSubscription(organizationId, preapproval.id, plan?.id, preapproval.status, preapproval.payer_email);
}

export async function cancelSubscription(organizationId: string, employeeId: string): Promise<Organization> {
  const { data, error } = await db().from("organizations").update({ subscription_status: "canceled" }).eq("id", organizationId).select().single();
  const organization = mapOrganization(must(data, error, "Organización no encontrada"));
  await logAudit(organizationId, employeeId, "Suscripción cancelada", `Plan ${organization.plan}`);
  return organization;
}

export async function simulateTrialExpired(organizationId: string): Promise<Organization> {
  const organization = await getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  if (organization.subscriptionStatus === "trialing") {
    const { data, error } = await db().from("organizations").update({ trial_ends_at: addDaysISO(todayISO(), -1) }).eq("id", organizationId).select().single();
    must(data, error);
    return mapOrganization(data);
  }
  return organization;
}
