import "server-only";
import type {
  AuditLogEntry,
  BillingInvoice,
  Booking,
  BookingPayment,
  BookingStatus,
  CashMovement,
  CashRegisterSession,
  Court,
  CourtSurface,
  Customer,
  Employee,
  EmployeeRole,
  Expense,
  ExpenseCategory,
  LoyaltyRedemption,
  LoyaltyReward,
  NotificationChannel,
  NotificationEntry,
  NotificationKind,
  Organization,
  PaymentMethod,
  Plan,
  PlanFeatureGroup,
  PlanId,
  PlatformAdmin,
  Product,
  ProductCategory,
  Promotion,
  RankingEntry,
  Sale,
  SaleItem,
  Sport,
  SubscriptionStatus,
  Tournament,
  TournamentMatch,
  TournamentTeam,
  WaitlistEntry,
} from "./types";
import { BLOCKING_STATUSES, generateSlots } from "./availability";
import { applyPromotion, computeDeposit, findApplicablePromotion, resolveSlotPrice } from "./pricing";
import { addDaysISO, dayOfWeek, minutesToTime, timeToMinutes, todayISO } from "./time";
import { mulberry32 } from "./seed-rng";

// ---------------------------------------------------------------------------
// In-memory mock "database" for SportControl.
//
// This stands in for Supabase Postgres until real credentials are configured
// (see .env.example). Every record already carries organizationId so the
// swap to `supabase/migrations/0001_init.sql` is a matter of replacing the
// functions below with real queries — the app code above this module never
// touches the storage shape directly.
//
// Multi-tenant: every tenant-scoped function takes `organizationId` as an
// explicit parameter (resolved from a session cookie or a URL slug by the
// caller, see src/lib/session.ts) rather than reading an implicit "current
// org" — a plain module-level variable would leak across concurrent
// requests from different tenants. `get*` lookups by entity id also check
// the record's organizationId, so guessing another tenant's id never works.
// ---------------------------------------------------------------------------

const ORG_PALERMO_ID = "org_palermo";

const organizations: Organization[] = [
  {
    id: ORG_PALERMO_ID,
    name: "Sport Club Palermo",
    slug: "sport-club-palermo",
    depositPercentage: 0.3,
    timezone: "America/Argentina/Buenos_Aires",
    plan: "business",
    subscriptionStatus: "active",
    billingEmail: "martin@palermo.club",
    currentPeriodEnd: addDaysISO(todayISO(), 18),
    mercadopagoSubscriptionId: "mp_sub_demo_1",
  },
];
let organizationSeq = 2;

const palermoOrg = organizations[0];

// Precio de referencia en USD (como lo pediste). Mercado Pago Suscripciones
// cobra en la moneda de la cuenta MP (normalmente ARS), así que al conectarlo
// de verdad hay que fijar `priceARS` con una cotización — acá se muestra un
// valor ilustrativo (~1000 ARS/USD) solo para no dejarlo vacío en la UI.
const USD_TO_ARS = 1000;

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceUSD: 27,
    tagline: "Para arrancar a ordenar las reservas",
    featureGroups: [],
    highlights: [
      "Reservas online con seña",
      "Agenda y canchas",
      "Clientes",
      "Dashboard básico",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceUSD: 57,
    tagline: "Para manejar todo el día a día del complejo",
    featureGroups: ["operacion"],
    highlights: [
      "Todo lo de Starter",
      "Caja y punto de venta",
      "Inventario y gastos",
      "Empleados y auditoría",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceUSD: 97,
    tagline: "Para crecer con torneos, fidelización y datos",
    featureGroups: ["operacion", "crecimiento", "inteligencia"],
    highlights: [
      "Todo lo de Pro",
      "Torneos, ranking y fidelización",
      "Promociones y lista de espera",
      "Analítica, alertas y reportes",
    ],
  },
];

// Contraseñas mock en texto plano — solo para esta demo sin backend real.
// Cuando se conecte Supabase Auth, las credenciales pasan a manejarse ahí
// por completo y este campo desaparece del modelo.
const DEMO_PASSWORD = "demo1234";

const employees: Employee[] = [
  { id: "emp_1", organizationId: ORG_PALERMO_ID, name: "Martín Suárez", email: "martin@palermo.club", password: DEMO_PASSWORD, role: "owner", active: true },
  { id: "emp_2", organizationId: ORG_PALERMO_ID, name: "Camila Ríos", email: "camila@palermo.club", password: DEMO_PASSWORD, role: "admin", active: true },
  { id: "emp_3", organizationId: ORG_PALERMO_ID, name: "Nico Álvarez", email: "nico@palermo.club", password: DEMO_PASSWORD, role: "cajero", active: true },
];
let employeeSeq = employees.length + 1;

// Superadmin (dueño de la plataforma SportControl) — no pertenece a ningún
// tenant. Credenciales vía variables de entorno con un default de
// desarrollo, nunca un secreto real hardcodeado en el repo.
const platformAdmins: PlatformAdmin[] = [
  {
    id: "padmin_1",
    email: process.env.SUPERADMIN_EMAIL ?? "admin@sportcontrol.app",
    password: process.env.SUPERADMIN_PASSWORD ?? "super1234",
  },
];

const weekdayPadelRules = (base: number) => [
  { id: "valle", label: "Hora valle", daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "16:00", pricePerSlot: base },
  { id: "normal", label: "Hora normal", daysOfWeek: [1, 2, 3, 4, 5], startTime: "16:00", endTime: "18:00", pricePerSlot: Math.round(base * 1.2) },
  { id: "pico", label: "Hora pico", daysOfWeek: [1, 2, 3, 4, 5], startTime: "18:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.47) },
  { id: "finde", label: "Fin de semana", daysOfWeek: [0, 6], startTime: "08:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.67) },
];

const weekdayFutbolRules = (base: number) => [
  { id: "valle", label: "Hora valle", daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", pricePerSlot: base },
  { id: "pico", label: "Hora pico", daysOfWeek: [1, 2, 3, 4, 5], startTime: "17:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.45) },
  { id: "finde", label: "Fin de semana", daysOfWeek: [0, 6], startTime: "09:00", endTime: "23:00", pricePerSlot: Math.round(base * 1.6) },
];

function withRuleIds(courtId: string, rules: ReturnType<typeof weekdayPadelRules>) {
  return rules.map((r) => ({ ...r, id: `${courtId}_${r.id}` }));
}

const courts: Court[] = [
  {
    id: "court_padel_1", organizationId: ORG_PALERMO_ID, name: "Pádel 1", sport: "padel",
    surface: "sintetico", indoor: true, lighting: true, slotMinutes: 90,
    openTime: "08:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel1", weekdayPadelRules(15000)), active: true,
  },
  {
    id: "court_padel_2", organizationId: ORG_PALERMO_ID, name: "Pádel 2", sport: "padel",
    surface: "sintetico", indoor: true, lighting: true, slotMinutes: 90,
    openTime: "08:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel2", weekdayPadelRules(15000)), active: true,
  },
  {
    id: "court_padel_3", organizationId: ORG_PALERMO_ID, name: "Pádel 3", sport: "padel",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 90,
    openTime: "08:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel3", weekdayPadelRules(16000)), active: true,
  },
  {
    id: "court_padel_4", organizationId: ORG_PALERMO_ID, name: "Pádel 4", sport: "padel",
    surface: "sintetico", indoor: false, lighting: false, slotMinutes: 90,
    openTime: "08:00", closeTime: "22:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel4", weekdayPadelRules(13000)), active: true,
  },
  {
    id: "court_futbol5_1", organizationId: ORG_PALERMO_ID, name: "Fútbol 5 #1", sport: "futbol5",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 60,
    openTime: "09:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("f5a", weekdayFutbolRules(18000)), active: true,
  },
  {
    id: "court_futbol5_2", organizationId: ORG_PALERMO_ID, name: "Fútbol 5 #2", sport: "futbol5",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 60,
    openTime: "09:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("f5b", weekdayFutbolRules(18000)), active: true,
  },
  {
    id: "court_futbol8_1", organizationId: ORG_PALERMO_ID, name: "Fútbol 8", sport: "futbol8",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 60,
    openTime: "09:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("f8", weekdayFutbolRules(26000)), active: true,
  },
];
let courtSeq = 1;

const customerNames = [
  "Juan Pérez", "Martín Gómez", "Lucas Díaz", "Sofía Fernández", "Agustina López",
  "Tomás Romero", "Valentina Torres", "Federico Ruiz", "Camila Sosa", "Nicolás Vega",
];

const customers: Customer[] = customerNames.map((name, i) => ({
  id: `cust_${i + 1}`,
  organizationId: ORG_PALERMO_ID,
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@mail.com`,
  phone: `+54 9 11 4${String(1000 + i * 37).padStart(4, "0")}-${String(2000 + i * 53).padStart(4, "0")}`,
  favoriteSport: i % 3 === 0 ? "futbol5" : "padel",
  loyaltyPoints: Math.round((i * 733) % 2200),
}));
let customerSeq = customers.length + 1;

// Target occupancy per court, matching the numbers used to design the dashboard.
const occupancyTarget: Record<string, number> = {
  court_padel_1: 0.82,
  court_padel_2: 0.74,
  court_padel_3: 0.91,
  court_padel_4: 0.63,
  court_futbol5_1: 0.88,
  court_futbol5_2: 0.79,
  court_futbol8_1: 0.7,
};

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

function statusForOffset(dayOffset: number, rand: () => number): BookingStatus {
  if (dayOffset < 0) {
    const r = rand();
    if (r < 0.06) return "no_show";
    if (r < 0.12) return "cancelada";
    return "finalizada";
  }
  if (dayOffset === 0) {
    const r = rand();
    if (r < 0.5) return "confirmada";
    if (r < 0.8) return "sena_pagada";
    return "pendiente_pago";
  }
  const r = rand();
  if (r < 0.55) return "confirmada";
  if (r < 0.9) return "sena_pagada";
  return "pendiente_pago";
}

function buildPayments(booking: Omit<Booking, "payments">, rand: () => number): BookingPayment[] {
  const payments: BookingPayment[] = [];
  const methods: Booking["payments"][number]["method"][] = [
    "mercado_pago", "efectivo", "transferencia", "tarjeta",
  ];
  const method = methods[Math.floor(rand() * methods.length)];
  const paidBase = `${booking.date}T${booking.startTime}:00`;

  if (booking.status !== "pendiente_pago") {
    payments.push({
      id: `pay_${booking.id}_sena`,
      bookingId: booking.id,
      concept: "sena",
      amount: booking.depositAmount,
      method: "mercado_pago",
      status: "aprobado",
      paidAt: paidBase,
    });
  }
  if (["confirmada", "en_curso", "finalizada"].includes(booking.status)) {
    payments.push({
      id: `pay_${booking.id}_saldo`,
      bookingId: booking.id,
      concept: "saldo",
      amount: booking.balanceAmount,
      method,
      status: "aprobado",
      paidAt: paidBase,
    });
  }
  return payments;
}

function seedBookings(): Booking[] {
  const rand = mulberry32(20260902);
  const bookings: Booking[] = [];
  const today = todayISO();

  // 5 semanas de historia + 1 hacia adelante, para que Fase 4 (analítica,
  // predicción de demanda) tenga datos reales sobre los que calcular tendencias.
  for (let offset = -35; offset <= 6; offset++) {
    const dateISO = addDaysISO(today, offset);
    for (const court of courts) {
      const starts = listSlotStarts(court, dateISO);
      const target = occupancyTarget[court.id] ?? 0.75;
      for (const startTime of starts) {
        if (rand() > target) continue;

        const endMinutes = timeToMinutes(startTime) + court.slotMinutes;
        const status = statusForOffset(offset, rand);
        const totalPrice = resolveSlotPrice(court, dateISO, startTime);
        const { depositAmount, balanceAmount } = computeDeposit(totalPrice, palermoOrg);
        const customer = customers[Math.floor(rand() * customers.length)];

        const id = `bk_${court.id}_${dateISO}_${startTime.replace(":", "")}`;
        const base: Omit<Booking, "payments"> = {
          id,
          organizationId: ORG_PALERMO_ID,
          courtId: court.id,
          customerId: customer.id,
          date: dateISO,
          startTime,
          endTime: minutesToTime(endMinutes),
          totalPrice,
          depositAmount,
          balanceAmount,
          status,
          createdAt: `${addDaysISO(dateISO, -2)}T10:00:00`,
        };
        bookings.push({ ...base, payments: buildPayments(base, rand) });
      }
    }
  }
  return bookings;
}

const bookings: Booking[] = seedBookings();
let bookingSeq = bookings.length + 1;

// ---------------------------------------------------------------------------
// Fase 2 — Operación: productos, inventario, caja/POS, gastos, auditoría
// ---------------------------------------------------------------------------

const productCategories: ProductCategory[] = [
  { id: "cat_bebidas", organizationId: ORG_PALERMO_ID, name: "Bebidas" },
  { id: "cat_snacks", organizationId: ORG_PALERMO_ID, name: "Snacks" },
  { id: "cat_comidas", organizationId: ORG_PALERMO_ID, name: "Comidas" },
  { id: "cat_accesorios", organizationId: ORG_PALERMO_ID, name: "Accesorios" },
];

const products: Product[] = [
  { id: "prod_agua", organizationId: ORG_PALERMO_ID, categoryId: "cat_bebidas", name: "Agua", sku: "BEB-001", cost: 1000, price: 2000, stock: 38, minStock: 15, active: true },
  { id: "prod_gatorade", organizationId: ORG_PALERMO_ID, categoryId: "cat_bebidas", name: "Gatorade", sku: "BEB-002", cost: 1800, price: 3500, stock: 8, minStock: 10, active: true },
  { id: "prod_cocacola", organizationId: ORG_PALERMO_ID, categoryId: "cat_bebidas", name: "Coca-Cola", sku: "BEB-003", cost: 1500, price: 3000, stock: 24, minStock: 12, active: true },
  { id: "prod_cerveza", organizationId: ORG_PALERMO_ID, categoryId: "cat_bebidas", name: "Cerveza", sku: "BEB-004", cost: 2200, price: 4000, stock: 30, minStock: 12, active: true },
  { id: "prod_cafe", organizationId: ORG_PALERMO_ID, categoryId: "cat_bebidas", name: "Café", sku: "BEB-005", cost: 1000, price: 2500, stock: 20, minStock: 10, active: true },
  { id: "prod_papas", organizationId: ORG_PALERMO_ID, categoryId: "cat_snacks", name: "Papas fritas", sku: "SNK-001", cost: 1400, price: 3000, stock: 6, minStock: 10, active: true },
  { id: "prod_alfajor", organizationId: ORG_PALERMO_ID, categoryId: "cat_snacks", name: "Alfajor", sku: "SNK-002", cost: 900, price: 1800, stock: 40, minStock: 15, active: true },
  { id: "prod_barrita", organizationId: ORG_PALERMO_ID, categoryId: "cat_snacks", name: "Barrita de cereal", sku: "SNK-003", cost: 1100, price: 2200, stock: 9, minStock: 10, active: true },
  { id: "prod_hamburguesa", organizationId: ORG_PALERMO_ID, categoryId: "cat_comidas", name: "Hamburguesa", sku: "CMD-001", cost: 3500, price: 7000, stock: 18, minStock: 8, active: true },
  { id: "prod_pancho", organizationId: ORG_PALERMO_ID, categoryId: "cat_comidas", name: "Pancho", sku: "CMD-002", cost: 2000, price: 4500, stock: 22, minStock: 8, active: true },
  { id: "prod_pelotas", organizationId: ORG_PALERMO_ID, categoryId: "cat_accesorios", name: "Pelotas de pádel (tubo x3)", sku: "ACC-001", cost: 7000, price: 12000, stock: 14, minStock: 6, active: true },
  { id: "prod_grip", organizationId: ORG_PALERMO_ID, categoryId: "cat_accesorios", name: "Grip", sku: "ACC-002", cost: 1200, price: 2500, stock: 3, minStock: 8, active: true },
  { id: "prod_remera", organizationId: ORG_PALERMO_ID, categoryId: "cat_accesorios", name: "Remera del club", sku: "ACC-003", cost: 9000, price: 18000, stock: 11, minStock: 5, active: true },
  { id: "prod_paleta", organizationId: ORG_PALERMO_ID, categoryId: "cat_accesorios", name: "Paleta de pádel", sku: "ACC-004", cost: 55000, price: 85000, stock: 4, minStock: 3, active: true },
];

const auditLog: AuditLogEntry[] = [];
let auditSeq = 1;

function logAudit(organizationId: string, employeeId: string | null, action: string, detail: string, when: string = new Date().toISOString()) {
  const employee = employeeId ? employees.find((e) => e.id === employeeId) : undefined;
  auditLog.unshift({
    id: `audit_${auditSeq++}`,
    organizationId,
    employeeId: employeeId ?? "system",
    employeeName: employee?.name ?? "Sistema",
    action,
    detail,
    createdAt: when,
  });
}

const expenseCategories: { category: ExpenseCategory; label: string; amount: number }[] = [
  { category: "alquiler", label: "Alquiler del predio", amount: 850000 },
  { category: "sueldos", label: "Sueldos del personal", amount: 1450000 },
  { category: "luz", label: "Factura de luz", amount: 180000 },
  { category: "agua", label: "Factura de agua", amount: 60000 },
  { category: "mantenimiento", label: "Mantenimiento de canchas", amount: 120000 },
  { category: "insumos", label: "Compra de bebidas y snacks", amount: 210000 },
  { category: "limpieza", label: "Insumos de limpieza", amount: 45000 },
  { category: "publicidad", label: "Publicidad en redes", amount: 60000 },
];

function seedExpenses(): Expense[] {
  const rand = mulberry32(20260902 + 7);
  const today = todayISO();
  const expenses: Expense[] = [];
  let seq = 1;

  for (let offset = -28; offset <= -1; offset++) {
    const dateISO = addDaysISO(today, offset);
    const dow = dayOfWeek(dateISO);
    // Alquiler y sueldos caen el día 1; el resto son más esporádicos.
    if (dateISO.endsWith("-01")) {
      expenses.push(makeExpense(seq++, "alquiler", "Alquiler del predio", 850000, dateISO));
      expenses.push(makeExpense(seq++, "sueldos", "Sueldos del personal", 1450000, dateISO));
    }
    if (dow === 5 && rand() < 0.7) {
      const pick = expenseCategories[Math.floor(rand() * expenseCategories.length)];
      expenses.push(makeExpense(seq++, pick.category, pick.label, Math.round(pick.amount * (0.7 + rand() * 0.6)), dateISO));
    }
  }
  return expenses;
}

function makeExpense(seq: number, category: ExpenseCategory, description: string, amount: number, dateISO: string): Expense {
  return {
    id: `exp_${seq}`,
    organizationId: ORG_PALERMO_ID,
    employeeId: "emp_1",
    category,
    description,
    amount,
    date: dateISO,
    createdAt: `${dateISO}T09:00:00`,
  };
}

const expenses: Expense[] = seedExpenses();
let expenseSeq = expenses.length + 1;

// Cash register: a few closed historical sessions with sales, plus no open
// session today — the operator has to "abrir caja" to start the demo, same
// as in a real shift.
const cashSessions: CashRegisterSession[] = [];
const cashMovements: CashMovement[] = [];
const sales: Sale[] = [];
let cashSessionSeq = 1;
let cashMovementSeq = 1;
let saleSeq = 1;

function seedCashHistory() {
  const rand = mulberry32(20260902 + 13);
  const today = todayISO();
  const cashiers = ["emp_2", "emp_3"];

  for (let offset = -21; offset <= -1; offset++) {
    const dateISO = addDaysISO(today, offset);
    const employeeId = cashiers[Math.floor(rand() * cashiers.length)];
    const openingAmount = 20000;
    const sessionId = `cash_${cashSessionSeq++}`;
    let cashTotal = openingAmount;

    const saleCount = 4 + Math.floor(rand() * 6);
    for (let i = 0; i < saleCount; i++) {
      const itemCount = 1 + Math.floor(rand() * 3);
      const items: SaleItem[] = [];
      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(rand() * products.length)];
        const quantity = 1 + Math.floor(rand() * 2);
        items.push({ productId: product.id, name: product.name, quantity, unitPrice: product.price });
      }
      const total = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
      const methods: PaymentMethod[] = ["efectivo", "mercado_pago", "tarjeta", "transferencia"];
      const method = methods[Math.floor(rand() * methods.length)];
      const time = `${String(9 + Math.floor(rand() * 13)).padStart(2, "0")}:${rand() < 0.5 ? "00" : "30"}`;

      sales.push({
        id: `sale_${saleSeq++}`,
        organizationId: ORG_PALERMO_ID,
        cashSessionId: sessionId,
        employeeId,
        items,
        total,
        method,
        createdAt: `${dateISO}T${time}:00`,
      });
      cashMovements.push({
        id: `cmov_${cashMovementSeq++}`,
        organizationId: ORG_PALERMO_ID,
        cashSessionId: sessionId,
        type: "venta",
        amount: total,
        method,
        concept: items.map((it) => `${it.quantity}x ${it.name}`).join(", "),
        employeeId,
        createdAt: `${dateISO}T${time}:00`,
      });
      if (method === "efectivo") cashTotal += total;
    }

    const closingCountedAmount = Math.max(0, Math.round(cashTotal + (rand() - 0.5) * 2000));
    cashSessions.push({
      id: sessionId,
      organizationId: ORG_PALERMO_ID,
      employeeId,
      status: "cerrada",
      openingAmount,
      openedAt: `${dateISO}T09:00:00`,
      closingCountedAmount,
      closedAt: `${dateISO}T22:00:00`,
    });
    logAudit(ORG_PALERMO_ID, employeeId, "Cierre de caja", `Caja cerrada con ${formatArs(closingCountedAmount)} contados`, `${dateISO}T22:01:00`);
  }
}

function formatArs(amount: number) {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

seedCashHistory();

// ---------------------------------------------------------------------------
// Fase 3 — Crecimiento: promociones, fidelización, lista de espera,
// notificaciones y torneos
// ---------------------------------------------------------------------------

const promotions: Promotion[] = [
  {
    id: "promo_happy_hour",
    organizationId: ORG_PALERMO_ID,
    label: "Happy Hour Pádel",
    discountPercentage: 0.2,
    daysOfWeek: [1, 2, 3, 4],
    startTime: "14:00",
    endTime: "17:00",
    sports: ["padel"],
    active: true,
  },
];
let promotionSeq = promotions.length + 1;

const loyaltyRewards: LoyaltyReward[] = [
  { id: "reward_bebida", label: "Bebida gratis", pointsCost: 150, kind: "producto" },
  { id: "reward_descuento", label: "$10.000 de descuento", pointsCost: 1000, kind: "descuento" },
  { id: "reward_hora", label: "Hora bonificada", pointsCost: 1800, kind: "hora_bonificada" },
];

const loyaltyRedemptions: LoyaltyRedemption[] = [];
let redemptionSeq = 1;

function awardLoyaltyPoints(customerId: string, amountSpent: number) {
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return;
  customer.loyaltyPoints += Math.floor(amountSpent / 100);
}

const waitlist: WaitlistEntry[] = [];
let waitlistSeq = 1;

const notifications: NotificationEntry[] = [];
let notificationSeq = 1;

function notify(organizationId: string, customerId: string, kind: NotificationKind, message: string, channel: NotificationChannel = "whatsapp") {
  notifications.unshift({
    id: `notif_${notificationSeq++}`,
    organizationId,
    customerId,
    channel,
    kind,
    message,
    createdAt: new Date().toISOString(),
  });
}

// ---- Torneos -----------------------------------------------------------

const tournaments: Tournament[] = [];
const tournamentTeams: TournamentTeam[] = [];
const tournamentMatches: TournamentMatch[] = [];
let tournamentSeq = 1;
let tournamentTeamSeq = 1;
let tournamentMatchSeq = 1;

function bracketSize(teamCount: number): number {
  let size = 2;
  while (size < teamCount) size *= 2;
  return size;
}

function propagateWinner(tournamentId: string, match: TournamentMatch) {
  if (!match.winnerTeamId) return;
  const nextRound = match.round + 1;
  const nextIndex = Math.floor(match.matchIndex / 2);
  const nextMatch = tournamentMatches.find(
    (m) => m.tournamentId === tournamentId && m.round === nextRound && m.matchIndex === nextIndex
  );
  if (!nextMatch) return; // era la final
  if (match.matchIndex % 2 === 0) nextMatch.teamAId = match.winnerTeamId;
  else nextMatch.teamBId = match.winnerTeamId;
}

function generateBracketInternal(tournamentId: string): TournamentMatch[] {
  const teams = tournamentTeams.filter((t) => t.tournamentId === tournamentId);
  const size = bracketSize(teams.length);
  const rounds = Math.log2(size);
  const slots: (string | undefined)[] = teams.map((t) => t.id);
  while (slots.length < size) slots.push(undefined);

  const round1: TournamentMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    const teamAId = slots[i * 2];
    const teamBId = slots[i * 2 + 1];
    const onlyOne = (teamAId && !teamBId) || (!teamAId && teamBId);
    round1.push({
      id: `tm_${tournamentMatchSeq++}`,
      tournamentId,
      round: 1,
      matchIndex: i,
      teamAId,
      teamBId,
      status: onlyOne ? "bye" : "pendiente",
      winnerTeamId: onlyOne ? (teamAId ?? teamBId) : undefined,
    });
  }
  const allMatches = [...round1];

  let prevRoundCount = size / 2;
  for (let r = 2; r <= rounds; r++) {
    const count = prevRoundCount / 2;
    for (let i = 0; i < count; i++) {
      allMatches.push({ id: `tm_${tournamentMatchSeq++}`, tournamentId, round: r, matchIndex: i, status: "pendiente" });
    }
    prevRoundCount = count;
  }

  tournamentMatches.push(...allMatches);
  for (const m of round1) {
    if (m.status === "bye") propagateWinner(tournamentId, m);
  }
  return allMatches;
}

function seedTournaments() {
  const today = todayISO();

  // Torneo 1: en curso, cuadro generado con resultados parciales cargados.
  const t1: Tournament = {
    id: `tourn_${tournamentSeq++}`,
    organizationId: ORG_PALERMO_ID,
    name: "Torneo Apertura Pádel",
    sport: "padel",
    category: "8va",
    date: addDaysISO(today, 12),
    maxTeams: 8,
    entryFee: 30000,
    prize: "Trofeo + kit de pelotas",
    status: "inscripcion",
    createdAt: addDaysISO(today, -20),
  };
  tournaments.push(t1);

  const t1Pairs = [
    ["Juan Pérez", "Martín Gómez"],
    ["Lucas Díaz", "Sofía Fernández"],
    ["Agustina López", "Tomás Romero"],
    ["Valentina Torres", "Federico Ruiz"],
    ["Camila Sosa", "Nicolás Vega"],
    ["Rocío Medina", "Ezequiel Paz"],
    ["Brenda Acosta", "Ignacio Castro"],
    ["Milagros Ibáñez", "Franco Molina"],
  ];
  for (const [p1, p2] of t1Pairs) {
    tournamentTeams.push({
      id: `tteam_${tournamentTeamSeq++}`,
      tournamentId: t1.id,
      name: `${p1.split(" ")[0]} / ${p2.split(" ")[0]}`,
      playerNames: [p1, p2],
      paidEntry: true,
      registeredAt: addDaysISO(today, -18),
    });
  }
  t1.status = "en_curso";
  const t1Matches = generateBracketInternal(t1.id);

  const round1 = t1Matches.filter((m) => m.round === 1);
  const round1Winners = [0, 0, 1, 0]; // índice de equipo ganador (0=A, 1=B) por partido
  round1.forEach((match, i) => {
    const winnerTeamId = round1Winners[i] === 0 ? match.teamAId : match.teamBId;
    match.status = "jugado";
    match.winnerTeamId = winnerTeamId;
    match.scoreLabel = ["6-4 6-3", "7-5 4-6 6-2", "6-2 6-4", "6-3 6-4"][i];
    propagateWinner(t1.id, match);
  });

  const round2 = t1Matches.filter((m) => m.round === 2);
  const semi1 = round2[0];
  semi1.status = "jugado";
  semi1.winnerTeamId = semi1.teamAId;
  semi1.scoreLabel = "6-4 6-2";
  propagateWinner(t1.id, semi1);

  // Torneo 2: todavía en inscripción, sin cuadro generado.
  const t2: Tournament = {
    id: `tourn_${tournamentSeq++}`,
    organizationId: ORG_PALERMO_ID,
    name: "Copa Otoño Fútbol 5",
    sport: "futbol5",
    category: "Libre",
    date: addDaysISO(today, 25),
    maxTeams: 8,
    entryFee: 15000,
    prize: "Copa + medallas",
    status: "inscripcion",
    createdAt: addDaysISO(today, -5),
  };
  tournaments.push(t2);

  const t2Teams = [
    { name: "Los Pibes FC", players: ["Diego Herrera", "Pablo Ríos", "Marcos Silva", "Emiliano Cruz", "Agustín Blanco"] },
    { name: "Tigres FC", players: ["Rodrigo Luna", "Bruno Vega", "Santiago Ortiz", "Julián Paz", "Matías Correa"] },
    { name: "Atlético Palermo", players: ["Franco Aguirre", "Nahuel Rivas", "Joaquín Soto", "Ramiro Núñez", "Ivo Campos"] },
  ];
  for (const team of t2Teams) {
    tournamentTeams.push({
      id: `tteam_${tournamentTeamSeq++}`,
      tournamentId: t2.id,
      name: team.name,
      playerNames: team.players,
      paidEntry: true,
      registeredAt: addDaysISO(today, -3),
    });
  }
}

seedTournaments();

// ---------------------------------------------------------------------------
// SaaS — historial de facturación de la suscripción (no de las canchas)
// ---------------------------------------------------------------------------

const billingInvoices: BillingInvoice[] = [];
let billingInvoiceSeq = 1;

function seedBillingInvoices() {
  const today = todayISO();
  // 3 meses pagados en Business, para que /admin/plan tenga historial real.
  for (let i = 3; i >= 1; i--) {
    const periodStart = addDaysISO(today, -30 * i);
    const periodEnd = addDaysISO(periodStart, 30);
    billingInvoices.push({
      id: `inv_${billingInvoiceSeq++}`,
      organizationId: ORG_PALERMO_ID,
      plan: "business",
      amountUSD: 97,
      status: "pagada",
      periodStart,
      periodEnd,
      createdAt: `${periodStart}T09:00:00`,
    });
  }
}

seedBillingInvoices();

// ---------------------------------------------------------------------------
// Sesiones (mock — token opaco en un Map, igual que sería una sesión real de
// Supabase Auth consultada server-side; ver src/lib/session.ts para el lado
// de las cookies).
// ---------------------------------------------------------------------------

export type SessionRecord =
  | { kind: "employee"; employeeId: string; organizationId: string }
  | { kind: "customer"; customerId: string; organizationId: string }
  | { kind: "superadmin"; adminId: string };

const sessions = new Map<string, SessionRecord>();

function randomToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createSession(record: SessionRecord): string {
  const token = randomToken();
  sessions.set(token, record);
  return token;
}

export function getSession(token: string | undefined | null): SessionRecord | undefined {
  if (!token) return undefined;
  return sessions.get(token);
}

export function destroySession(token: string | undefined | null) {
  if (token) sessions.delete(token);
}

export function verifyEmployeeCredentials(email: string, password: string): Employee | undefined {
  return employees.find(
    (e) => e.active && e.email.toLowerCase() === email.trim().toLowerCase() && e.password === password
  );
}

export function verifyPlatformAdminCredentials(email: string, password: string): PlatformAdmin | undefined {
  return platformAdmins.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
  );
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

function generateUniqueSlug(name: string): string {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (organizations.some((o) => o.slug === candidate) || RESERVED_SLUGS.has(candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

function seedDefaultCourtsFor(organizationId: string) {
  const padelId = `court_${courtSeq++}`;
  courts.push({
    id: padelId, organizationId, name: "Cancha de pádel 1", sport: "padel",
    surface: "sintetico", indoor: true, lighting: true, slotMinutes: 90,
    openTime: "08:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds(padelId, weekdayPadelRules(15000)), active: true,
  });
  const futbolId = `court_${courtSeq++}`;
  courts.push({
    id: futbolId, organizationId, name: "Fútbol 5", sport: "futbol5",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 60,
    openTime: "09:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds(futbolId, weekdayFutbolRules(18000)), active: true,
  });
}

const TRIAL_DAYS = 7;

export function createOrganization(input: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  planId: PlanId;
}): { organization: Organization; owner: Employee } {
  if (employees.some((e) => e.email.toLowerCase() === input.ownerEmail.trim().toLowerCase())) {
    throw new Error("Ya existe una cuenta con ese email");
  }

  const organization: Organization = {
    id: `org_${organizationSeq++}`,
    name: input.name,
    slug: generateUniqueSlug(input.name),
    depositPercentage: 0.3,
    timezone: "America/Argentina/Buenos_Aires",
    plan: input.planId,
    subscriptionStatus: "trialing",
    billingEmail: input.ownerEmail,
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
  organizations.push(organization);

  const owner: Employee = {
    id: `emp_${employeeSeq++}`,
    organizationId: organization.id,
    name: input.ownerName,
    email: input.ownerEmail,
    password: input.ownerPassword,
    role: "owner",
    active: true,
  };
  employees.push(owner);

  seedDefaultCourtsFor(organization.id);
  logAudit(organization.id, owner.id, "Cuenta creada", `${organization.name} · plan ${input.planId} · prueba gratis ${TRIAL_DAYS} días`);

  return { organization, owner };
}

export function getOrganizationById(organizationId: string): Organization | undefined {
  return organizations.find((o) => o.id === organizationId);
}

export function getOrganizationBySlug(slug: string): Organization | undefined {
  return organizations.find((o) => o.slug === slug);
}

export function createCourt(organizationId: string, input: {
  name: string;
  sport: Sport;
  surface: CourtSurface;
  indoor: boolean;
  lighting: boolean;
  slotMinutes: number;
  openTime: string;
  closeTime: string;
  basePrice: number;
}): Court {
  const id = `court_${courtSeq++}`;
  const rules = input.sport === "padel" ? weekdayPadelRules(input.basePrice) : weekdayFutbolRules(input.basePrice);
  const court: Court = {
    id,
    organizationId,
    name: input.name,
    sport: input.sport,
    surface: input.surface,
    indoor: input.indoor,
    lighting: input.lighting,
    slotMinutes: input.slotMinutes,
    openTime: input.openTime,
    closeTime: input.closeTime,
    daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds(id, rules),
    active: true,
  };
  courts.push(court);
  return court;
}

export function findOrCreateGuestCustomer(organizationId: string, input: { name: string; email: string; phone: string }): Customer {
  const existing = customers.find(
    (c) => c.organizationId === organizationId && c.email.toLowerCase() === input.email.trim().toLowerCase()
  );
  if (existing) {
    existing.name = input.name || existing.name;
    existing.phone = input.phone || existing.phone;
    return existing;
  }
  const customer: Customer = {
    id: `cust_${customerSeq++}`,
    organizationId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    loyaltyPoints: 0,
  };
  customers.push(customer);
  return customer;
}

// ---- Superadmin (cross-tenant) --------------------------------------------
// Las funciones de acá abajo deliberadamente NO filtran por organizationId —
// es la única parte de la app pensada para ver todos los tenants a la vez.
// Nunca se deben usar desde una página del panel de un dueño de cancha.

export function listOrganizations(): Organization[] {
  return [...organizations].sort((a, b) => a.name.localeCompare(b.name));
}

export interface OrgSummary {
  organization: Organization;
  ownerEmail: string;
  employeeCount: number;
  courtCount: number;
  bookingCount: number;
}

export function listOrgSummaries(): OrgSummary[] {
  return listOrganizations().map((organization) => {
    const owner = employees.find((e) => e.organizationId === organization.id && e.role === "owner");
    return {
      organization,
      ownerEmail: owner?.email ?? organization.billingEmail ?? "—",
      employeeCount: employees.filter((e) => e.organizationId === organization.id).length,
      courtCount: courts.filter((c) => c.organizationId === organization.id).length,
      bookingCount: bookings.filter((b) => b.organizationId === organization.id).length,
    };
  });
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
}

export function getPlatformStats(): PlatformStats {
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

  return {
    totalOrgs: organizations.length,
    trialingCount: byStatus("trialing"),
    activeCount: byStatus("active"),
    pastDueCount: byStatus("past_due"),
    canceledCount: byStatus("canceled"),
    trialsEndingSoon,
    mrrUSD,
    planDistribution,
  };
}

export function adminChangePlan(organizationId: string, planId: PlanId): Organization {
  const organization = getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  organization.plan = planId;
  return organization;
}

export function adminSetSubscriptionStatus(organizationId: string, status: SubscriptionStatus): Organization {
  const organization = getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  organization.subscriptionStatus = status;
  return organization;
}

// ---------------------------------------------------------------------------
// Read queries (tenant-scoped: siempre reciben organizationId)
// ---------------------------------------------------------------------------

export function listPlans(): Plan[] {
  return PLANS;
}

export function getPlan(planId: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function priceInArs(priceUSD: number): number {
  return priceUSD * USD_TO_ARS;
}

export function listBillingInvoices(organizationId: string): BillingInvoice[] {
  return billingInvoices
    .filter((i) => i.organizationId === organizationId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export type AccessState =
  | { blocked: false; trialDaysLeft?: number }
  | { blocked: true; reason: "trial_expired" | "canceled" | "past_due" };

export function computeAccessState(organizationId: string): AccessState {
  const org = getOrganizationById(organizationId);
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

export function hasFeatureAccess(organizationId: string, group: PlanFeatureGroup): boolean {
  const org = getOrganizationById(organizationId);
  const plan = org ? getPlan(org.plan) : undefined;
  return plan ? plan.featureGroups.includes(group) : false;
}

export function listEmployees(organizationId: string): Employee[] {
  return employees.filter((e) => e.organizationId === organizationId);
}

export function getEmployeeById(organizationId: string, employeeId: string): Employee | undefined {
  return employees.find((e) => e.id === employeeId && e.organizationId === organizationId);
}

export function listCourts(organizationId: string): Court[] {
  return courts.filter((c) => c.organizationId === organizationId);
}

export function getCourt(organizationId: string, courtId: string): Court | undefined {
  return courts.find((c) => c.id === courtId && c.organizationId === organizationId);
}

export function listCustomers(organizationId: string): Customer[] {
  return customers.filter((c) => c.organizationId === organizationId);
}

export function getCustomer(organizationId: string, customerId: string): Customer | undefined {
  return customers.find((c) => c.id === customerId && c.organizationId === organizationId);
}

export function listBookings(organizationId: string): Booking[] {
  return bookings.filter((b) => b.organizationId === organizationId);
}

export function listBookingsForDate(organizationId: string, dateISO: string): Booking[] {
  return bookings.filter((b) => b.organizationId === organizationId && b.date === dateISO);
}

export function listBookingsForCourtAndDate(organizationId: string, courtId: string, dateISO: string): Booking[] {
  return bookings.filter((b) => b.organizationId === organizationId && b.courtId === courtId && b.date === dateISO);
}

export function listBookingsForCustomer(organizationId: string, customerId: string): Booking[] {
  return bookings
    .filter((b) => b.organizationId === organizationId && b.customerId === customerId)
    .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1));
}

export function getBooking(organizationId: string, bookingId: string): Booking | undefined {
  return bookings.find((b) => b.id === bookingId && b.organizationId === organizationId);
}

export function getSlotsForCourt(organizationId: string, courtId: string, dateISO: string) {
  const court = getCourt(organizationId, courtId);
  if (!court) return [];

  const orgBookings = bookings.filter((b) => b.organizationId === organizationId);
  const orgPromotions = promotions.filter((p) => p.organizationId === organizationId);

  return generateSlots(court, dateISO, orgBookings).map((slot) => {
    const promotion = findApplicablePromotion(orgPromotions, court, dateISO, slot.startTime);
    const { finalPrice, discountLabel } = applyPromotion(slot.basePrice, promotion);
    return { ...slot, price: finalPrice, discountLabel };
  });
}

export function listProductCategories(organizationId: string): ProductCategory[] {
  return productCategories.filter((c) => c.organizationId === organizationId);
}

export function listProducts(organizationId: string): Product[] {
  return products.filter((p) => p.organizationId === organizationId);
}

export function getProduct(organizationId: string, productId: string): Product | undefined {
  return products.find((p) => p.id === productId && p.organizationId === organizationId);
}

export function listLowStockProducts(organizationId: string): Product[] {
  return products.filter((p) => p.organizationId === organizationId && p.active && p.stock <= p.minStock);
}

export function listExpenses(organizationId: string): Expense[] {
  return expenses.filter((e) => e.organizationId === organizationId).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function listExpensesForMonth(organizationId: string, yearMonth: string): Expense[] {
  return listExpenses(organizationId).filter((e) => e.date.startsWith(yearMonth));
}

export function getOpenCashSession(organizationId: string): CashRegisterSession | undefined {
  return cashSessions.find((s) => s.organizationId === organizationId && s.status === "abierta");
}

export function listCashSessions(organizationId: string): CashRegisterSession[] {
  return cashSessions
    .filter((s) => s.organizationId === organizationId)
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
}

export function getCashSession(organizationId: string, sessionId: string): CashRegisterSession | undefined {
  return cashSessions.find((s) => s.id === sessionId && s.organizationId === organizationId);
}

export function listCashMovements(organizationId: string, sessionId: string): CashMovement[] {
  return cashMovements
    .filter((m) => m.organizationId === organizationId && m.cashSessionId === sessionId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listSales(organizationId: string): Sale[] {
  return sales.filter((s) => s.organizationId === organizationId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listSalesForSession(organizationId: string, sessionId: string): Sale[] {
  return sales.filter((s) => s.organizationId === organizationId && s.cashSessionId === sessionId);
}

export function listAuditLog(organizationId: string): AuditLogEntry[] {
  return auditLog.filter((a) => a.organizationId === organizationId);
}

export function listPromotions(organizationId: string): Promotion[] {
  return promotions.filter((p) => p.organizationId === organizationId);
}

export function listLoyaltyRewards(): LoyaltyReward[] {
  return loyaltyRewards;
}

export function listLoyaltyRedemptions(organizationId: string, customerId: string): LoyaltyRedemption[] {
  return loyaltyRedemptions.filter((r) => r.organizationId === organizationId && r.customerId === customerId);
}

export function listWaitlistForCustomer(organizationId: string, customerId: string): WaitlistEntry[] {
  return waitlist.filter((w) => w.organizationId === organizationId && w.customerId === customerId);
}

export function listWaitlistForSlot(organizationId: string, courtId: string, date: string, startTime: string): WaitlistEntry[] {
  return waitlist.filter(
    (w) =>
      w.organizationId === organizationId &&
      w.courtId === courtId &&
      w.date === date &&
      w.startTime === startTime &&
      w.status === "esperando"
  );
}

export function listNotifications(organizationId: string): NotificationEntry[] {
  return notifications.filter((n) => n.organizationId === organizationId);
}

export function listNotificationsForCustomer(organizationId: string, customerId: string): NotificationEntry[] {
  return notifications.filter((n) => n.organizationId === organizationId && n.customerId === customerId);
}

export function listTournaments(organizationId: string): Tournament[] {
  return tournaments.filter((t) => t.organizationId === organizationId).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getTournament(organizationId: string, tournamentId: string): Tournament | undefined {
  return tournaments.find((t) => t.id === tournamentId && t.organizationId === organizationId);
}

export function listTeamsForTournament(tournamentId: string): TournamentTeam[] {
  return tournamentTeams.filter((t) => t.tournamentId === tournamentId);
}

export function getTeam(teamId: string): TournamentTeam | undefined {
  return tournamentTeams.find((t) => t.id === teamId);
}

export function listMatchesForTournament(tournamentId: string): TournamentMatch[] {
  return tournamentMatches
    .filter((m) => m.tournamentId === tournamentId)
    .sort((a, b) => a.round - b.round || a.matchIndex - b.matchIndex);
}

export function computeRanking(organizationId: string): RankingEntry[] {
  const orgTournamentIds = new Set(tournaments.filter((t) => t.organizationId === organizationId).map((t) => t.id));

  const roundsByTournament = new Map<string, number>();
  for (const m of tournamentMatches) {
    if (!orgTournamentIds.has(m.tournamentId)) continue;
    roundsByTournament.set(m.tournamentId, Math.max(roundsByTournament.get(m.tournamentId) ?? 0, m.round));
  }

  const pointsMap = new Map<string, RankingEntry>();
  for (const m of tournamentMatches) {
    if (!orgTournamentIds.has(m.tournamentId)) continue;
    if (m.status !== "jugado" || !m.winnerTeamId) continue;
    const team = tournamentTeams.find((t) => t.id === m.winnerTeamId);
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
// Fase 4 — Inteligencia: analítica, predicción de demanda, alertas
//
// Todo lo de acá abajo son vistas derivadas de datos que ya existen (bookings,
// expenses, sales, tournamentTeams) — no agregan estado nuevo. Usan los 35
// días de historial + 21 de caja sembrados en seedBookings/seedCashHistory
// para tener algo real sobre lo que calcular tendencias.
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

// Todo lo que no sea "cancelada" cuenta como demanda real de ese horario
// (un no-show igual ocupó el turno y perdió la seña).
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

export function computeCourtRevenueRanking(organizationId: string) {
  const dates = new Set(historicalDateRange());
  const orgCourts = courts.filter((c) => c.organizationId === organizationId && c.active);
  const historical = bookings.filter(
    (b) => b.organizationId === organizationId && dates.has(b.date) && DEMAND_STATUSES.has(b.status)
  );

  return orgCourts
    .map((court) => {
      const courtBookings = historical.filter((b) => b.courtId === court.id);
      const revenue = courtBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const possible = countPossibleSlots(court, [...dates]);
      return { court, revenue, occupancyPct: possible ? courtBookings.length / possible : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function computeHourBandStats(organizationId: string) {
  const dates = new Set(historicalDateRange());
  const orgCourts = courts.filter((c) => c.organizationId === organizationId && c.active);
  const historical = bookings.filter(
    (b) => b.organizationId === organizationId && dates.has(b.date) && DEMAND_STATUSES.has(b.status)
  );

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

export function computeWeekdayStats(organizationId: string) {
  const dates = historicalDateRange();
  const orgCourts = courts.filter((c) => c.organizationId === organizationId && c.active);
  const historical = bookings.filter(
    (b) => b.organizationId === organizationId && dates.includes(b.date) && DEMAND_STATUSES.has(b.status)
  );

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

// Combinaciones cancha + día + franja horaria con más baja ocupación
// histórica (con al menos `minSamples` turnos posibles, para no recomendar
// en base a 1 sola fecha). Pensado para alimentar "creá una promo acá".
export function computeLowDemandRecommendations(organizationId: string, limit = 3): DemandRecommendation[] {
  const dates = historicalDateRange();
  const orgCourts = courts.filter((c) => c.organizationId === organizationId && c.active);
  const historical = bookings.filter(
    (b) => b.organizationId === organizationId && dates.includes(b.date) && DEMAND_STATUSES.has(b.status)
  );

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

export function computeHighDemandBand(organizationId: string): DemandRecommendation | undefined {
  const recs = computeLowDemandRecommendations(organizationId, 1000);
  if (recs.length === 0) return undefined;
  return [...recs].sort((a, b) => b.occupancyPct - a.occupancyPct)[0];
}

export function computePaymentMethodTotals(organizationId: string) {
  const totals = new Map<PaymentMethod, number>();
  for (const b of bookings.filter((b) => b.organizationId === organizationId)) {
    for (const p of b.payments) totals.set(p.method, (totals.get(p.method) ?? 0) + p.amount);
  }
  for (const s of sales.filter((s) => s.organizationId === organizationId)) {
    totals.set(s.method, (totals.get(s.method) ?? 0) + s.total);
  }
  return [...totals.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}

export function computeRevenueByCategory(organizationId: string) {
  const orgBookings = bookings.filter((b) => b.organizationId === organizationId);
  const orgSales = sales.filter((s) => s.organizationId === organizationId);
  const orgTournaments = tournaments.filter((t) => t.organizationId === organizationId);

  const canchas = orgBookings.reduce((sum, b) => sum + b.payments.reduce((s, p) => s + p.amount, 0), 0);
  const productos = orgSales.reduce((sum, s) => sum + s.total, 0);
  const torneos = orgTournaments.reduce((sum, t) => {
    const registered = tournamentTeams.filter((team) => team.tournamentId === t.id && team.paidEntry).length;
    return sum + registered * t.entryFee;
  }, 0);
  return { canchas, productos, torneos, total: canchas + productos + torneos };
}

export function computeProfitAndLoss(organizationId: string) {
  const { total: ingresos } = computeRevenueByCategory(organizationId);
  const gastos = expenses.filter((e) => e.organizationId === organizationId).reduce((sum, e) => sum + e.amount, 0);
  return { ingresos, gastos, resultado: ingresos - gastos, margin: ingresos ? (ingresos - gastos) / ingresos : 0 };
}

export function computeDailyRevenue(organizationId: string, days = 14) {
  const today = todayISO();
  const result: { date: string; canchas: number; productos: number; total: number }[] = [];
  const orgBookings = bookings.filter((b) => b.organizationId === organizationId);
  const orgSales = sales.filter((s) => s.organizationId === organizationId);

  for (let offset = -(days - 1); offset <= 0; offset++) {
    const date = addDaysISO(today, offset);
    const canchas = orgBookings
      .flatMap((b) => b.payments)
      .filter((p) => p.paidAt.startsWith(date))
      .reduce((sum, p) => sum + p.amount, 0);
    const productos = orgSales.filter((s) => s.createdAt.startsWith(date)).reduce((sum, s) => sum + s.total, 0);
    result.push({ date, canchas, productos, total: canchas + productos });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Mutations (mock — swap for Supabase inserts/updates later)
// ---------------------------------------------------------------------------

export function isSlotAvailable(organizationId: string, courtId: string, date: string, startTime: string): boolean {
  return !bookings.some(
    (b) =>
      b.organizationId === organizationId &&
      b.courtId === courtId &&
      b.date === date &&
      b.startTime === startTime &&
      BLOCKING_STATUSES.has(b.status)
  );
}

export function createPendingBooking(organizationId: string, input: {
  courtId: string;
  customerId: string;
  date: string;
  startTime: string;
  recurringGroupId?: string;
}): Booking {
  const court = getCourt(organizationId, input.courtId);
  if (!court) throw new Error("Cancha no encontrada");
  if (!isSlotAvailable(organizationId, input.courtId, input.date, input.startTime)) {
    throw new Error("Ese horario ya no está disponible");
  }
  const org = getOrganizationById(organizationId);
  if (!org) throw new Error("Organización no encontrada");

  const endMinutes = timeToMinutes(input.startTime) + court.slotMinutes;
  const basePrice = resolveSlotPrice(court, input.date, input.startTime);
  const orgPromotions = promotions.filter((p) => p.organizationId === organizationId);
  const promotion = findApplicablePromotion(orgPromotions, court, input.date, input.startTime);
  const { finalPrice, discountLabel } = applyPromotion(basePrice, promotion);
  const { depositAmount, balanceAmount } = computeDeposit(finalPrice, org);

  const booking: Booking = {
    id: `bk_manual_${bookingSeq++}`,
    organizationId,
    courtId: input.courtId,
    customerId: input.customerId,
    date: input.date,
    startTime: input.startTime,
    endTime: minutesToTime(endMinutes),
    totalPrice: finalPrice,
    depositAmount,
    balanceAmount,
    status: "pendiente_pago",
    payments: [],
    createdAt: new Date().toISOString(),
    recurringGroupId: input.recurringGroupId,
    discountLabel,
  };
  bookings.push(booking);
  return booking;
}

export function payDeposit(organizationId: string, bookingId: string, method: BookingPayment["method"] = "mercado_pago"): Booking {
  const booking = bookings.find((b) => b.id === bookingId && b.organizationId === organizationId);
  if (!booking) throw new Error("Reserva no encontrada");

  booking.payments.push({
    id: `pay_${bookingId}_sena_${Date.now()}`,
    bookingId,
    concept: "sena",
    amount: booking.depositAmount,
    method,
    status: "aprobado",
    paidAt: new Date().toISOString(),
  });
  booking.status = "sena_pagada";
  awardLoyaltyPoints(booking.customerId, booking.depositAmount);

  const court = getCourt(organizationId, booking.courtId);
  notify(
    organizationId,
    booking.customerId,
    "reserva_confirmada",
    `Tu reserva quedó confirmada para el ${booking.date} a las ${booking.startTime} en ${court?.name ?? "tu cancha"}.`
  );

  return booking;
}

export function collectBalance(organizationId: string, employeeId: string, bookingId: string, method: BookingPayment["method"]): Booking {
  const booking = bookings.find((b) => b.id === bookingId && b.organizationId === organizationId);
  if (!booking) throw new Error("Reserva no encontrada");

  booking.payments.push({
    id: `pay_${bookingId}_saldo_${Date.now()}`,
    bookingId,
    concept: "saldo",
    amount: booking.balanceAmount,
    method,
    status: "aprobado",
    paidAt: new Date().toISOString(),
  });
  booking.status = "confirmada";

  const openSession = getOpenCashSession(organizationId);
  if (openSession) {
    cashMovements.push({
      id: `cmov_${cashMovementSeq++}`,
      organizationId,
      cashSessionId: openSession.id,
      type: "cobro_reserva",
      amount: booking.balanceAmount,
      method,
      concept: `Saldo reserva #${booking.id.slice(-6)}`,
      employeeId,
      createdAt: new Date().toISOString(),
    });
  }
  logAudit(organizationId, employeeId, "Cobro de saldo", `Reserva #${booking.id.slice(-6)} — ${formatArs(booking.balanceAmount)} (${method})`);
  awardLoyaltyPoints(booking.customerId, booking.balanceAmount);

  return booking;
}

const AUDITED_STATUS_LABELS: Partial<Record<BookingStatus, string>> = {
  cancelada: "Cancelación de reserva",
  no_show: "No show registrado",
  confirmada: "Reserva confirmada",
  en_curso: "Turno iniciado",
  finalizada: "Turno finalizado",
};

export function updateBookingStatus(organizationId: string, employeeId: string, bookingId: string, status: BookingStatus): Booking {
  const booking = bookings.find((b) => b.id === bookingId && b.organizationId === organizationId);
  if (!booking) throw new Error("Reserva no encontrada");
  booking.status = status;

  const label = AUDITED_STATUS_LABELS[status];
  if (label) {
    logAudit(organizationId, employeeId, label, `Reserva #${booking.id.slice(-6)}`);
  }

  if (status === "cancelada") {
    const court = getCourt(organizationId, booking.courtId);
    notify(
      organizationId,
      booking.customerId,
      "cancelacion",
      `Se canceló tu reserva del ${booking.date} a las ${booking.startTime} en ${court?.name ?? "la cancha"}.`
    );
    notifyWaitlist(organizationId, booking.courtId, booking.date, booking.startTime);
  }

  return booking;
}

function notifyWaitlist(organizationId: string, courtId: string, date: string, startTime: string) {
  const court = getCourt(organizationId, courtId);
  const waiting = waitlist.filter(
    (w) =>
      w.organizationId === organizationId &&
      w.courtId === courtId &&
      w.date === date &&
      w.startTime === startTime &&
      w.status === "esperando"
  );
  for (const entry of waiting) {
    entry.status = "notificado";
    entry.notifiedAt = new Date().toISOString();
    notify(
      organizationId,
      entry.customerId,
      "lista_espera_liberada",
      `¡Se liberó tu horario en ${court?.name ?? "la cancha"} el ${date} a las ${startTime}! Reservalo antes de que se lo lleve otro.`
    );
  }
}

// ---------------------------------------------------------------------------
// Fase 2 mutations: inventario, caja/POS, gastos, empleados
// ---------------------------------------------------------------------------

export function adjustStock(organizationId: string, employeeId: string, productId: string, delta: number, reason: string): Product {
  const product = products.find((p) => p.id === productId && p.organizationId === organizationId);
  if (!product) throw new Error("Producto no encontrado");
  product.stock = Math.max(0, product.stock + delta);
  logAudit(organizationId, employeeId, "Ajuste de stock", `${product.name}: ${delta > 0 ? "+" : ""}${delta} (${reason})`);
  return product;
}

export function openCashSession(organizationId: string, employeeId: string, openingAmount: number): CashRegisterSession {
  if (getOpenCashSession(organizationId)) throw new Error("Ya hay una caja abierta");

  const session: CashRegisterSession = {
    id: `cash_${cashSessionSeq++}`,
    organizationId,
    employeeId,
    status: "abierta",
    openingAmount,
    openedAt: new Date().toISOString(),
  };
  cashSessions.push(session);
  logAudit(organizationId, employeeId, "Apertura de caja", `Monto inicial ${formatArs(openingAmount)}`);
  return session;
}

export function closeCashSession(organizationId: string, employeeId: string, sessionId: string, countedAmount: number): CashRegisterSession {
  const session = cashSessions.find((s) => s.id === sessionId && s.organizationId === organizationId);
  if (!session) throw new Error("Caja no encontrada");

  session.status = "cerrada";
  session.closingCountedAmount = countedAmount;
  session.closedAt = new Date().toISOString();
  logAudit(organizationId, employeeId, "Cierre de caja", `Caja cerrada con ${formatArs(countedAmount)} contados`);
  return session;
}

export function createSale(organizationId: string, input: {
  employeeId: string;
  items: { productId: string; quantity: number }[];
  method: PaymentMethod;
}): Sale {
  const openSession = getOpenCashSession(organizationId);
  if (!openSession) throw new Error("No hay una caja abierta");
  if (input.items.length === 0) throw new Error("La venta no tiene productos");

  const items: SaleItem[] = input.items.map(({ productId, quantity }) => {
    const product = products.find((p) => p.id === productId && p.organizationId === organizationId);
    if (!product) throw new Error("Producto no encontrado");
    if (product.stock < quantity) throw new Error(`Stock insuficiente de ${product.name}`);
    return { productId, name: product.name, quantity, unitPrice: product.price };
  });

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    product.stock -= item.quantity;
  }

  const total = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const sale: Sale = {
    id: `sale_${saleSeq++}`,
    organizationId,
    cashSessionId: openSession.id,
    employeeId: input.employeeId,
    items,
    total,
    method: input.method,
    createdAt: new Date().toISOString(),
  };
  sales.push(sale);

  cashMovements.push({
    id: `cmov_${cashMovementSeq++}`,
    organizationId,
    cashSessionId: openSession.id,
    type: "venta",
    amount: total,
    method: input.method,
    concept: items.map((it) => `${it.quantity}x ${it.name}`).join(", "),
    employeeId: input.employeeId,
    createdAt: sale.createdAt,
  });

  logAudit(organizationId, input.employeeId, "Venta registrada", `${formatArs(total)} — ${sale.items.map((it) => it.name).join(", ")}`);
  return sale;
}

export function addExpense(organizationId: string, input: {
  employeeId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}): Expense {
  const expense: Expense = {
    id: `exp_${expenseSeq++}`,
    organizationId,
    ...input,
    createdAt: new Date().toISOString(),
  };
  expenses.push(expense);

  const openSession = getOpenCashSession(organizationId);
  if (openSession && expense.date === todayISO()) {
    cashMovements.push({
      id: `cmov_${cashMovementSeq++}`,
      organizationId,
      cashSessionId: openSession.id,
      type: "gasto",
      amount: -expense.amount,
      method: "efectivo",
      concept: expense.description,
      employeeId: input.employeeId,
      createdAt: expense.createdAt,
    });
  }

  logAudit(organizationId, input.employeeId, "Gasto registrado", `${expense.description} — ${formatArs(expense.amount)}`);
  return expense;
}

export function addEmployee(organizationId: string, actorEmployeeId: string, input: { name: string; email: string; role: EmployeeRole; password: string }): Employee {
  if (employees.some((e) => e.email.toLowerCase() === input.email.trim().toLowerCase())) {
    throw new Error("Ya existe un usuario con ese email");
  }
  const employee: Employee = { id: `emp_${employeeSeq++}`, organizationId, active: true, ...input };
  employees.push(employee);
  logAudit(organizationId, actorEmployeeId, "Empleado agregado", `${employee.name} (${employee.role})`);
  return employee;
}

export function updateEmployeeRole(organizationId: string, actorEmployeeId: string, employeeId: string, role: EmployeeRole): Employee {
  const employee = employees.find((e) => e.id === employeeId && e.organizationId === organizationId);
  if (!employee) throw new Error("Empleado no encontrado");
  employee.role = role;
  logAudit(organizationId, actorEmployeeId, "Rol actualizado", `${employee.name} ahora es ${role}`);
  return employee;
}

export function setEmployeeActive(organizationId: string, actorEmployeeId: string, employeeId: string, active: boolean): Employee {
  const employee = employees.find((e) => e.id === employeeId && e.organizationId === organizationId);
  if (!employee) throw new Error("Empleado no encontrado");
  employee.active = active;
  logAudit(organizationId, actorEmployeeId, active ? "Empleado reactivado" : "Empleado desactivado", employee.name);
  return employee;
}

// ---------------------------------------------------------------------------
// Fase 3 mutations: reservas recurrentes, lista de espera, fidelización,
// promociones, torneos
// ---------------------------------------------------------------------------

export function createRecurringBooking(organizationId: string, input: {
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
    if (!isSlotAvailable(organizationId, input.courtId, date, input.startTime)) {
      skipped.push(date);
      continue;
    }
    const booking = createPendingBooking(organizationId, {
      courtId: input.courtId,
      customerId: input.customerId,
      date,
      startTime: input.startTime,
      recurringGroupId: groupId,
    });
    payDeposit(organizationId, booking.id, "mercado_pago");
    created.push(booking);
  }

  return { created, skipped };
}

export function joinWaitlist(organizationId: string, customerId: string, courtId: string, date: string, startTime: string): WaitlistEntry {
  const existing = waitlist.find(
    (w) =>
      w.organizationId === organizationId &&
      w.customerId === customerId &&
      w.courtId === courtId &&
      w.date === date &&
      w.startTime === startTime &&
      w.status === "esperando"
  );
  if (existing) return existing;

  const entry: WaitlistEntry = {
    id: `wl_${waitlistSeq++}`,
    organizationId,
    customerId,
    courtId,
    date,
    startTime,
    status: "esperando",
    createdAt: new Date().toISOString(),
  };
  waitlist.push(entry);
  return entry;
}

export function redeemLoyaltyReward(organizationId: string, customerId: string, rewardId: string): LoyaltyRedemption {
  const customer = customers.find((c) => c.id === customerId && c.organizationId === organizationId);
  if (!customer) throw new Error("Cliente no encontrado");
  const reward = loyaltyRewards.find((r) => r.id === rewardId);
  if (!reward) throw new Error("Beneficio no encontrado");
  if (customer.loyaltyPoints < reward.pointsCost) throw new Error("No tenés puntos suficientes");

  customer.loyaltyPoints -= reward.pointsCost;
  const redemption: LoyaltyRedemption = {
    id: `redeem_${redemptionSeq++}`,
    organizationId,
    customerId,
    rewardId,
    rewardLabel: reward.label,
    pointsSpent: reward.pointsCost,
    createdAt: new Date().toISOString(),
  };
  loyaltyRedemptions.push(redemption);
  logAudit(organizationId, null, "Canje de puntos", `${customer.name} canjeó "${reward.label}"`);
  return redemption;
}

export function createPromotion(organizationId: string, actorEmployeeId: string, input: Omit<Promotion, "id" | "organizationId">): Promotion {
  const promotion: Promotion = { id: `promo_${promotionSeq++}`, organizationId, ...input };
  promotions.push(promotion);
  logAudit(organizationId, actorEmployeeId, "Promoción creada", `${promotion.label} (-${Math.round(promotion.discountPercentage * 100)}%)`);
  return promotion;
}

export function setPromotionActive(organizationId: string, actorEmployeeId: string, promotionId: string, active: boolean): Promotion {
  const promotion = promotions.find((p) => p.id === promotionId && p.organizationId === organizationId);
  if (!promotion) throw new Error("Promoción no encontrada");
  promotion.active = active;
  logAudit(organizationId, actorEmployeeId, active ? "Promoción activada" : "Promoción desactivada", promotion.label);
  return promotion;
}

export function createTournament(
  organizationId: string,
  actorEmployeeId: string,
  input: Omit<Tournament, "id" | "organizationId" | "status" | "createdAt">
): Tournament {
  const tournament: Tournament = {
    id: `tourn_${tournamentSeq++}`,
    organizationId,
    status: "inscripcion",
    createdAt: new Date().toISOString(),
    ...input,
  };
  tournaments.push(tournament);
  logAudit(organizationId, actorEmployeeId, "Torneo creado", tournament.name);
  return tournament;
}

export function registerTeam(organizationId: string, input: {
  tournamentId: string;
  name: string;
  playerNames: string[];
  customerId?: string;
}): TournamentTeam {
  const tournament = tournaments.find((t) => t.id === input.tournamentId && t.organizationId === organizationId);
  if (!tournament) throw new Error("Torneo no encontrado");
  if (tournament.status !== "inscripcion") throw new Error("La inscripción ya cerró");

  const currentTeams = tournamentTeams.filter((t) => t.tournamentId === input.tournamentId);
  if (currentTeams.length >= tournament.maxTeams) throw new Error("No hay cupos disponibles");

  const team: TournamentTeam = {
    id: `tteam_${tournamentTeamSeq++}`,
    tournamentId: input.tournamentId,
    name: input.name,
    playerNames: input.playerNames,
    customerId: input.customerId,
    paidEntry: true,
    registeredAt: new Date().toISOString(),
  };
  tournamentTeams.push(team);
  logAudit(organizationId, null, "Equipo inscripto", `${team.name} en ${tournament.name}`);

  if (input.customerId) {
    notify(
      organizationId,
      input.customerId,
      "torneo_inscripcion",
      `Inscribimos a "${team.name}" en ${tournament.name}. ¡Nos vemos el ${tournament.date}!`
    );
  }
  return team;
}

export function generateBracket(organizationId: string, actorEmployeeId: string, tournamentId: string): TournamentMatch[] {
  const tournament = tournaments.find((t) => t.id === tournamentId && t.organizationId === organizationId);
  if (!tournament) throw new Error("Torneo no encontrado");
  const teams = tournamentTeams.filter((t) => t.tournamentId === tournamentId);
  if (teams.length < 2) throw new Error("Necesitás al menos 2 equipos para generar el cuadro");
  if (tournamentMatches.some((m) => m.tournamentId === tournamentId)) {
    throw new Error("El cuadro ya fue generado");
  }

  const matches = generateBracketInternal(tournamentId);
  tournament.status = "en_curso";
  logAudit(organizationId, actorEmployeeId, "Cuadro generado", `${tournament.name} — ${teams.length} equipos`);
  return matches;
}

export function recordMatchResult(organizationId: string, actorEmployeeId: string, matchId: string, winnerTeamId: string, scoreLabel?: string): TournamentMatch {
  const match = tournamentMatches.find((m) => m.id === matchId);
  if (!match) throw new Error("Partido no encontrado");
  const tournament = tournaments.find((t) => t.id === match.tournamentId && t.organizationId === organizationId);
  if (!tournament) throw new Error("Torneo no encontrado");
  if (!match.teamAId || !match.teamBId) throw new Error("Todavía faltan equipos para este partido");
  if (winnerTeamId !== match.teamAId && winnerTeamId !== match.teamBId) throw new Error("Equipo inválido");

  match.winnerTeamId = winnerTeamId;
  match.scoreLabel = scoreLabel;
  match.status = "jugado";
  propagateWinner(match.tournamentId, match);

  const hasNextRound = tournamentMatches.some(
    (m) => m.tournamentId === match.tournamentId && m.round === match.round + 1
  );
  if (!hasNextRound) tournament.status = "finalizado";

  const winner = tournamentTeams.find((t) => t.id === winnerTeamId);
  logAudit(organizationId, actorEmployeeId, "Resultado cargado", `${winner?.name ?? winnerTeamId} ganó (ronda ${match.round})`);
  return match;
}

// ---------------------------------------------------------------------------
// SaaS mutations: cambio de plan, facturación de la propia cuenta
// (`createOrganization`, más arriba, es lo que reemplaza al viejo
// `startTrial` para el registro real de una cuenta nueva).
// ---------------------------------------------------------------------------

export function changePlan(organizationId: string, employeeId: string, planId: PlanId): Organization {
  const organization = getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  const previous = organization.plan;
  organization.plan = planId;
  logAudit(organizationId, employeeId, "Plan cambiado", `${previous} → ${planId}`);
  return organization;
}

// Simula el checkout de Mercado Pago Suscripciones: siempre aprobado, como el
// resto de los pagos de esta demo. Reemplazar por la preferencia/webhook real
// de MP cuando haya credenciales.
export function activateSubscription(organizationId: string, employeeId: string, billingEmail: string): Organization {
  const organization = getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  const plan = getPlan(organization.plan);
  if (!plan) throw new Error("Plan inválido");

  organization.subscriptionStatus = "active";
  organization.billingEmail = billingEmail;
  organization.trialEndsAt = undefined;
  organization.currentPeriodEnd = addDaysISO(todayISO(), 30);
  organization.mercadopagoSubscriptionId = organization.mercadopagoSubscriptionId ?? `mp_sub_${Date.now()}`;

  billingInvoices.push({
    id: `inv_${billingInvoiceSeq++}`,
    organizationId,
    plan: plan.id,
    amountUSD: plan.priceUSD,
    status: "pagada",
    periodStart: todayISO(),
    periodEnd: organization.currentPeriodEnd,
    createdAt: new Date().toISOString(),
  });

  logAudit(organizationId, employeeId, "Suscripción activada", `Plan ${plan.name} — USD ${plan.priceUSD}/mes`);
  return organization;
}

export function cancelSubscription(organizationId: string, employeeId: string): Organization {
  const organization = getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  organization.subscriptionStatus = "canceled";
  logAudit(organizationId, employeeId, "Suscripción cancelada", `Plan ${organization.plan}`);
  return organization;
}

// Solo para poder mostrar en la demo cómo se ve el paywall sin esperar 7 días reales.
export function simulateTrialExpired(organizationId: string): Organization {
  const organization = getOrganizationById(organizationId);
  if (!organization) throw new Error("Organización no encontrada");
  if (organization.subscriptionStatus === "trialing") {
    organization.trialEndsAt = addDaysISO(todayISO(), -1);
  }
  return organization;
}
