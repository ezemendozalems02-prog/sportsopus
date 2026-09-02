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
  Product,
  ProductCategory,
  Promotion,
  RankingEntry,
  Sale,
  SaleItem,
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
// ---------------------------------------------------------------------------

const ORG_ID = "org_palermo";

const organization: Organization = {
  id: ORG_ID,
  name: "Sport Club Palermo",
  slug: "sport-club-palermo",
  depositPercentage: 0.3,
  timezone: "America/Argentina/Buenos_Aires",
  plan: "business",
  subscriptionStatus: "active",
  billingEmail: "martin@palermo.club",
  currentPeriodEnd: addDaysISO(todayISO(), 18),
  mercadopagoSubscriptionId: "mp_sub_demo_1",
};

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

const employees: Employee[] = [
  { id: "emp_1", organizationId: ORG_ID, name: "Martín Suárez", email: "martin@palermo.club", role: "owner", active: true },
  { id: "emp_2", organizationId: ORG_ID, name: "Camila Ríos", email: "camila@palermo.club", role: "admin", active: true },
  { id: "emp_3", organizationId: ORG_ID, name: "Nico Álvarez", email: "nico@palermo.club", role: "cajero", active: true },
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
    id: "court_padel_1", organizationId: ORG_ID, name: "Pádel 1", sport: "padel",
    surface: "sintetico", indoor: true, lighting: true, slotMinutes: 90,
    openTime: "08:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel1", weekdayPadelRules(15000)), active: true,
  },
  {
    id: "court_padel_2", organizationId: ORG_ID, name: "Pádel 2", sport: "padel",
    surface: "sintetico", indoor: true, lighting: true, slotMinutes: 90,
    openTime: "08:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel2", weekdayPadelRules(15000)), active: true,
  },
  {
    id: "court_padel_3", organizationId: ORG_ID, name: "Pádel 3", sport: "padel",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 90,
    openTime: "08:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel3", weekdayPadelRules(16000)), active: true,
  },
  {
    id: "court_padel_4", organizationId: ORG_ID, name: "Pádel 4", sport: "padel",
    surface: "sintetico", indoor: false, lighting: false, slotMinutes: 90,
    openTime: "08:00", closeTime: "22:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("padel4", weekdayPadelRules(13000)), active: true,
  },
  {
    id: "court_futbol5_1", organizationId: ORG_ID, name: "Fútbol 5 #1", sport: "futbol5",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 60,
    openTime: "09:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("f5a", weekdayFutbolRules(18000)), active: true,
  },
  {
    id: "court_futbol5_2", organizationId: ORG_ID, name: "Fútbol 5 #2", sport: "futbol5",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 60,
    openTime: "09:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("f5b", weekdayFutbolRules(18000)), active: true,
  },
  {
    id: "court_futbol8_1", organizationId: ORG_ID, name: "Fútbol 8", sport: "futbol8",
    surface: "sintetico", indoor: false, lighting: true, slotMinutes: 60,
    openTime: "09:00", closeTime: "23:00", daysOpen: [0, 1, 2, 3, 4, 5, 6],
    priceRules: withRuleIds("f8", weekdayFutbolRules(26000)), active: true,
  },
];

const customerNames = [
  "Juan Pérez", "Martín Gómez", "Lucas Díaz", "Sofía Fernández", "Agustina López",
  "Tomás Romero", "Valentina Torres", "Federico Ruiz", "Camila Sosa", "Nicolás Vega",
];

const customers: Customer[] = customerNames.map((name, i) => ({
  id: `cust_${i + 1}`,
  organizationId: ORG_ID,
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@mail.com`,
  phone: `+54 9 11 4${String(1000 + i * 37).padStart(4, "0")}-${String(2000 + i * 53).padStart(4, "0")}`,
  favoriteSport: i % 3 === 0 ? "futbol5" : "padel",
  loyaltyPoints: Math.round((i * 733) % 2200),
}));

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
        const { depositAmount, balanceAmount } = computeDeposit(totalPrice, organization);
        const customer = customers[Math.floor(rand() * customers.length)];

        const id = `bk_${court.id}_${dateISO}_${startTime.replace(":", "")}`;
        const base: Omit<Booking, "payments"> = {
          id,
          organizationId: ORG_ID,
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
  { id: "cat_bebidas", organizationId: ORG_ID, name: "Bebidas" },
  { id: "cat_snacks", organizationId: ORG_ID, name: "Snacks" },
  { id: "cat_comidas", organizationId: ORG_ID, name: "Comidas" },
  { id: "cat_accesorios", organizationId: ORG_ID, name: "Accesorios" },
];

const products: Product[] = [
  { id: "prod_agua", organizationId: ORG_ID, categoryId: "cat_bebidas", name: "Agua", sku: "BEB-001", cost: 1000, price: 2000, stock: 38, minStock: 15, active: true },
  { id: "prod_gatorade", organizationId: ORG_ID, categoryId: "cat_bebidas", name: "Gatorade", sku: "BEB-002", cost: 1800, price: 3500, stock: 8, minStock: 10, active: true },
  { id: "prod_cocacola", organizationId: ORG_ID, categoryId: "cat_bebidas", name: "Coca-Cola", sku: "BEB-003", cost: 1500, price: 3000, stock: 24, minStock: 12, active: true },
  { id: "prod_cerveza", organizationId: ORG_ID, categoryId: "cat_bebidas", name: "Cerveza", sku: "BEB-004", cost: 2200, price: 4000, stock: 30, minStock: 12, active: true },
  { id: "prod_cafe", organizationId: ORG_ID, categoryId: "cat_bebidas", name: "Café", sku: "BEB-005", cost: 1000, price: 2500, stock: 20, minStock: 10, active: true },
  { id: "prod_papas", organizationId: ORG_ID, categoryId: "cat_snacks", name: "Papas fritas", sku: "SNK-001", cost: 1400, price: 3000, stock: 6, minStock: 10, active: true },
  { id: "prod_alfajor", organizationId: ORG_ID, categoryId: "cat_snacks", name: "Alfajor", sku: "SNK-002", cost: 900, price: 1800, stock: 40, minStock: 15, active: true },
  { id: "prod_barrita", organizationId: ORG_ID, categoryId: "cat_snacks", name: "Barrita de cereal", sku: "SNK-003", cost: 1100, price: 2200, stock: 9, minStock: 10, active: true },
  { id: "prod_hamburguesa", organizationId: ORG_ID, categoryId: "cat_comidas", name: "Hamburguesa", sku: "CMD-001", cost: 3500, price: 7000, stock: 18, minStock: 8, active: true },
  { id: "prod_pancho", organizationId: ORG_ID, categoryId: "cat_comidas", name: "Pancho", sku: "CMD-002", cost: 2000, price: 4500, stock: 22, minStock: 8, active: true },
  { id: "prod_pelotas", organizationId: ORG_ID, categoryId: "cat_accesorios", name: "Pelotas de pádel (tubo x3)", sku: "ACC-001", cost: 7000, price: 12000, stock: 14, minStock: 6, active: true },
  { id: "prod_grip", organizationId: ORG_ID, categoryId: "cat_accesorios", name: "Grip", sku: "ACC-002", cost: 1200, price: 2500, stock: 3, minStock: 8, active: true },
  { id: "prod_remera", organizationId: ORG_ID, categoryId: "cat_accesorios", name: "Remera del club", sku: "ACC-003", cost: 9000, price: 18000, stock: 11, minStock: 5, active: true },
  { id: "prod_paleta", organizationId: ORG_ID, categoryId: "cat_accesorios", name: "Paleta de pádel", sku: "ACC-004", cost: 55000, price: 85000, stock: 4, minStock: 3, active: true },
];

const auditLog: AuditLogEntry[] = [];
let auditSeq = 1;

function logAudit(employeeId: string, action: string, detail: string, when: string = new Date().toISOString()) {
  const employee = employees.find((e) => e.id === employeeId);
  auditLog.unshift({
    id: `audit_${auditSeq++}`,
    organizationId: ORG_ID,
    employeeId,
    employeeName: employee?.name ?? "Desconocido",
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
    organizationId: ORG_ID,
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
        organizationId: ORG_ID,
        cashSessionId: sessionId,
        employeeId,
        items,
        total,
        method,
        createdAt: `${dateISO}T${time}:00`,
      });
      cashMovements.push({
        id: `cmov_${cashMovementSeq++}`,
        organizationId: ORG_ID,
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
      organizationId: ORG_ID,
      employeeId,
      status: "cerrada",
      openingAmount,
      openedAt: `${dateISO}T09:00:00`,
      closingCountedAmount,
      closedAt: `${dateISO}T22:00:00`,
    });
    logAudit(employeeId, "Cierre de caja", `Caja cerrada con ${formatArs(closingCountedAmount)} contados`, `${dateISO}T22:01:00`);
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
    organizationId: ORG_ID,
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

function notify(customerId: string, kind: NotificationKind, message: string, channel: NotificationChannel = "whatsapp") {
  notifications.unshift({
    id: `notif_${notificationSeq++}`,
    organizationId: ORG_ID,
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
    organizationId: ORG_ID,
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
    organizationId: ORG_ID,
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
      organizationId: ORG_ID,
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
// Read queries
// ---------------------------------------------------------------------------

export function getOrganization(): Organization {
  return organization;
}

export function listPlans(): Plan[] {
  return PLANS;
}

export function getPlan(planId: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function priceInArs(priceUSD: number): number {
  return priceUSD * USD_TO_ARS;
}

export function listBillingInvoices(): BillingInvoice[] {
  return [...billingInvoices].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export type AccessState =
  | { blocked: false; trialDaysLeft?: number }
  | { blocked: true; reason: "trial_expired" | "canceled" | "past_due" };

export function computeAccessState(): AccessState {
  const org = organization;
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

export function hasFeatureAccess(group: PlanFeatureGroup): boolean {
  const plan = getPlan(organization.plan);
  return plan ? plan.featureGroups.includes(group) : false;
}

export function listEmployees(): Employee[] {
  return employees;
}

export function listCourts(): Court[] {
  return courts;
}

export function getCourt(courtId: string): Court | undefined {
  return courts.find((c) => c.id === courtId);
}

export function listCustomers(): Customer[] {
  return customers;
}

export function getCustomer(customerId: string): Customer | undefined {
  return customers.find((c) => c.id === customerId);
}

export function listBookings(): Booking[] {
  return bookings;
}

export function listBookingsForDate(dateISO: string): Booking[] {
  return bookings.filter((b) => b.date === dateISO);
}

export function listBookingsForCourtAndDate(courtId: string, dateISO: string): Booking[] {
  return bookings.filter((b) => b.courtId === courtId && b.date === dateISO);
}

export function listBookingsForCustomer(customerId: string): Booking[] {
  return bookings
    .filter((b) => b.customerId === customerId)
    .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? 1 : -1));
}

export function getBooking(bookingId: string): Booking | undefined {
  return bookings.find((b) => b.id === bookingId);
}

export function getSlotsForCourt(courtId: string, dateISO: string) {
  const court = getCourt(courtId);
  if (!court) return [];

  return generateSlots(court, dateISO, bookings).map((slot) => {
    const promotion = findApplicablePromotion(promotions, court, dateISO, slot.startTime);
    const { finalPrice, discountLabel } = applyPromotion(slot.basePrice, promotion);
    return { ...slot, price: finalPrice, discountLabel };
  });
}

export function listProductCategories(): ProductCategory[] {
  return productCategories;
}

export function listProducts(): Product[] {
  return products;
}

export function getProduct(productId: string): Product | undefined {
  return products.find((p) => p.id === productId);
}

export function listLowStockProducts(): Product[] {
  return products.filter((p) => p.active && p.stock <= p.minStock);
}

export function listExpenses(): Expense[] {
  return [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function listExpensesForMonth(yearMonth: string): Expense[] {
  return listExpenses().filter((e) => e.date.startsWith(yearMonth));
}

export function getOpenCashSession(): CashRegisterSession | undefined {
  return cashSessions.find((s) => s.status === "abierta");
}

export function listCashSessions(): CashRegisterSession[] {
  return [...cashSessions].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
}

export function getCashSession(sessionId: string): CashRegisterSession | undefined {
  return cashSessions.find((s) => s.id === sessionId);
}

export function listCashMovements(sessionId: string): CashMovement[] {
  return cashMovements
    .filter((m) => m.cashSessionId === sessionId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listSales(): Sale[] {
  return [...sales].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listSalesForSession(sessionId: string): Sale[] {
  return sales.filter((s) => s.cashSessionId === sessionId);
}

export function listAuditLog(): AuditLogEntry[] {
  return auditLog;
}

// The mock session: everything in this MVP acts as this logged-in employee
// (the owner) until real Supabase Auth + role-based access replaces it.
export function getCurrentEmployee(): Employee {
  return employees[0];
}

export function listPromotions(): Promotion[] {
  return promotions;
}

export function listLoyaltyRewards(): LoyaltyReward[] {
  return loyaltyRewards;
}

export function listLoyaltyRedemptions(customerId: string): LoyaltyRedemption[] {
  return loyaltyRedemptions.filter((r) => r.customerId === customerId);
}

export function listWaitlistForCustomer(customerId: string): WaitlistEntry[] {
  return waitlist.filter((w) => w.customerId === customerId);
}

export function listWaitlistForSlot(courtId: string, date: string, startTime: string): WaitlistEntry[] {
  return waitlist.filter(
    (w) => w.courtId === courtId && w.date === date && w.startTime === startTime && w.status === "esperando"
  );
}

export function listNotifications(): NotificationEntry[] {
  return notifications;
}

export function listNotificationsForCustomer(customerId: string): NotificationEntry[] {
  return notifications.filter((n) => n.customerId === customerId);
}

export function listTournaments(): Tournament[] {
  return [...tournaments].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getTournament(tournamentId: string): Tournament | undefined {
  return tournaments.find((t) => t.id === tournamentId);
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

export function computeRanking(): RankingEntry[] {
  const roundsByTournament = new Map<string, number>();
  for (const m of tournamentMatches) {
    roundsByTournament.set(m.tournamentId, Math.max(roundsByTournament.get(m.tournamentId) ?? 0, m.round));
  }

  const pointsMap = new Map<string, RankingEntry>();
  for (const m of tournamentMatches) {
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

export function computeCourtRevenueRanking() {
  const dates = new Set(historicalDateRange());
  const historical = bookings.filter((b) => dates.has(b.date) && DEMAND_STATUSES.has(b.status));

  return courts
    .filter((c) => c.active)
    .map((court) => {
      const courtBookings = historical.filter((b) => b.courtId === court.id);
      const revenue = courtBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const possible = countPossibleSlots(court, [...dates]);
      return { court, revenue, occupancyPct: possible ? courtBookings.length / possible : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function computeHourBandStats() {
  const dates = new Set(historicalDateRange());
  const historical = bookings.filter((b) => dates.has(b.date) && DEMAND_STATUSES.has(b.status));

  return HOUR_BANDS.map((band) => {
    const inBand = historical.filter((b) => hourBandFor(b.startTime).label === band.label);
    const revenue = inBand.reduce((sum, b) => sum + b.totalPrice, 0);

    let possible = 0;
    for (const court of courts.filter((c) => c.active)) {
      for (const date of dates) {
        possible += listSlotStarts(court, date).filter((s) => hourBandFor(s).label === band.label).length;
      }
    }
    return { label: band.label, revenue, occupancyPct: possible ? inBand.length / possible : 0 };
  });
}

export function computeWeekdayStats() {
  const dates = historicalDateRange();
  const historical = bookings.filter((b) => dates.includes(b.date) && DEMAND_STATUSES.has(b.status));

  return WEEKDAY_LABELS.map((label, dow) => {
    const datesForDow = dates.filter((d) => dayOfWeek(d) === dow);
    const bookingsForDow = historical.filter((b) => datesForDow.includes(b.date));
    let possible = 0;
    for (const court of courts.filter((c) => c.active)) possible += countPossibleSlots(court, datesForDow);
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
export function computeLowDemandRecommendations(limit = 3): DemandRecommendation[] {
  const dates = historicalDateRange();
  const historical = bookings.filter((b) => dates.includes(b.date) && DEMAND_STATUSES.has(b.status));

  const buckets = new Map<string, { court: Court; dow: number; band: string; possible: number; taken: number }>();
  for (const court of courts.filter((c) => c.active)) {
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

export function computeHighDemandBand(): DemandRecommendation | undefined {
  const recs = computeLowDemandRecommendations(1000);
  if (recs.length === 0) return undefined;
  return [...recs].sort((a, b) => b.occupancyPct - a.occupancyPct)[0];
}

export function computePaymentMethodTotals() {
  const totals = new Map<PaymentMethod, number>();
  for (const b of bookings) {
    for (const p of b.payments) totals.set(p.method, (totals.get(p.method) ?? 0) + p.amount);
  }
  for (const s of sales) {
    totals.set(s.method, (totals.get(s.method) ?? 0) + s.total);
  }
  return [...totals.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
}

export function computeRevenueByCategory() {
  const canchas = bookings.reduce((sum, b) => sum + b.payments.reduce((s, p) => s + p.amount, 0), 0);
  const productos = sales.reduce((sum, s) => sum + s.total, 0);
  const torneos = tournaments.reduce((sum, t) => {
    const registered = tournamentTeams.filter((team) => team.tournamentId === t.id && team.paidEntry).length;
    return sum + registered * t.entryFee;
  }, 0);
  return { canchas, productos, torneos, total: canchas + productos + torneos };
}

export function computeProfitAndLoss() {
  const { total: ingresos } = computeRevenueByCategory();
  const gastos = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { ingresos, gastos, resultado: ingresos - gastos, margin: ingresos ? (ingresos - gastos) / ingresos : 0 };
}

export function computeDailyRevenue(days = 14) {
  const today = todayISO();
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
// Mutations (mock — swap for Supabase inserts/updates later)
// ---------------------------------------------------------------------------

export function isSlotAvailable(courtId: string, date: string, startTime: string): boolean {
  return !bookings.some(
    (b) => b.courtId === courtId && b.date === date && b.startTime === startTime && BLOCKING_STATUSES.has(b.status)
  );
}

export function createPendingBooking(input: {
  courtId: string;
  customerId: string;
  date: string;
  startTime: string;
  recurringGroupId?: string;
}): Booking {
  const court = getCourt(input.courtId);
  if (!court) throw new Error("Cancha no encontrada");
  if (!isSlotAvailable(input.courtId, input.date, input.startTime)) {
    throw new Error("Ese horario ya no está disponible");
  }

  const endMinutes = timeToMinutes(input.startTime) + court.slotMinutes;
  const basePrice = resolveSlotPrice(court, input.date, input.startTime);
  const promotion = findApplicablePromotion(promotions, court, input.date, input.startTime);
  const { finalPrice, discountLabel } = applyPromotion(basePrice, promotion);
  const { depositAmount, balanceAmount } = computeDeposit(finalPrice, organization);

  const booking: Booking = {
    id: `bk_manual_${bookingSeq++}`,
    organizationId: ORG_ID,
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

export function payDeposit(bookingId: string, method: BookingPayment["method"] = "mercado_pago"): Booking {
  const booking = bookings.find((b) => b.id === bookingId);
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

  const court = getCourt(booking.courtId);
  notify(
    booking.customerId,
    "reserva_confirmada",
    `Tu reserva quedó confirmada para el ${booking.date} a las ${booking.startTime} en ${court?.name ?? "tu cancha"}.`
  );

  return booking;
}

export function collectBalance(bookingId: string, method: BookingPayment["method"]): Booking {
  const booking = bookings.find((b) => b.id === bookingId);
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

  const employee = getCurrentEmployee();
  const openSession = getOpenCashSession();
  if (openSession) {
    cashMovements.push({
      id: `cmov_${cashMovementSeq++}`,
      organizationId: ORG_ID,
      cashSessionId: openSession.id,
      type: "cobro_reserva",
      amount: booking.balanceAmount,
      method,
      concept: `Saldo reserva #${booking.id.slice(-6)}`,
      employeeId: employee.id,
      createdAt: new Date().toISOString(),
    });
  }
  logAudit(employee.id, "Cobro de saldo", `Reserva #${booking.id.slice(-6)} — ${formatArs(booking.balanceAmount)} (${method})`);
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

export function updateBookingStatus(bookingId: string, status: BookingStatus): Booking {
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error("Reserva no encontrada");
  booking.status = status;

  const label = AUDITED_STATUS_LABELS[status];
  if (label) {
    logAudit(getCurrentEmployee().id, label, `Reserva #${booking.id.slice(-6)}`);
  }

  if (status === "cancelada") {
    const court = getCourt(booking.courtId);
    notify(
      booking.customerId,
      "cancelacion",
      `Se canceló tu reserva del ${booking.date} a las ${booking.startTime} en ${court?.name ?? "la cancha"}.`
    );
    notifyWaitlist(booking.courtId, booking.date, booking.startTime);
  }

  return booking;
}

function notifyWaitlist(courtId: string, date: string, startTime: string) {
  const court = getCourt(courtId);
  const waiting = waitlist.filter(
    (w) => w.courtId === courtId && w.date === date && w.startTime === startTime && w.status === "esperando"
  );
  for (const entry of waiting) {
    entry.status = "notificado";
    entry.notifiedAt = new Date().toISOString();
    notify(
      entry.customerId,
      "lista_espera_liberada",
      `¡Se liberó tu horario en ${court?.name ?? "la cancha"} el ${date} a las ${startTime}! Reservalo antes de que se lo lleve otro.`
    );
  }
}

// ---------------------------------------------------------------------------
// Fase 2 mutations: inventario, caja/POS, gastos, empleados
// ---------------------------------------------------------------------------

export function adjustStock(productId: string, delta: number, reason: string): Product {
  const product = products.find((p) => p.id === productId);
  if (!product) throw new Error("Producto no encontrado");
  product.stock = Math.max(0, product.stock + delta);
  logAudit(getCurrentEmployee().id, "Ajuste de stock", `${product.name}: ${delta > 0 ? "+" : ""}${delta} (${reason})`);
  return product;
}

export function openCashSession(employeeId: string, openingAmount: number): CashRegisterSession {
  if (getOpenCashSession()) throw new Error("Ya hay una caja abierta");

  const session: CashRegisterSession = {
    id: `cash_${cashSessionSeq++}`,
    organizationId: ORG_ID,
    employeeId,
    status: "abierta",
    openingAmount,
    openedAt: new Date().toISOString(),
  };
  cashSessions.push(session);
  logAudit(employeeId, "Apertura de caja", `Monto inicial ${formatArs(openingAmount)}`);
  return session;
}

export function closeCashSession(sessionId: string, countedAmount: number): CashRegisterSession {
  const session = cashSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Caja no encontrada");

  session.status = "cerrada";
  session.closingCountedAmount = countedAmount;
  session.closedAt = new Date().toISOString();
  logAudit(getCurrentEmployee().id, "Cierre de caja", `Caja cerrada con ${formatArs(countedAmount)} contados`);
  return session;
}

export function createSale(input: {
  employeeId: string;
  items: { productId: string; quantity: number }[];
  method: PaymentMethod;
}): Sale {
  const openSession = getOpenCashSession();
  if (!openSession) throw new Error("No hay una caja abierta");
  if (input.items.length === 0) throw new Error("La venta no tiene productos");

  const items: SaleItem[] = input.items.map(({ productId, quantity }) => {
    const product = products.find((p) => p.id === productId);
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
    organizationId: ORG_ID,
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
    organizationId: ORG_ID,
    cashSessionId: openSession.id,
    type: "venta",
    amount: total,
    method: input.method,
    concept: items.map((it) => `${it.quantity}x ${it.name}`).join(", "),
    employeeId: input.employeeId,
    createdAt: sale.createdAt,
  });

  logAudit(input.employeeId, "Venta registrada", `${formatArs(total)} — ${sale.items.map((it) => it.name).join(", ")}`);
  return sale;
}

export function addExpense(input: {
  employeeId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}): Expense {
  const expense: Expense = {
    id: `exp_${expenseSeq++}`,
    organizationId: ORG_ID,
    ...input,
    createdAt: new Date().toISOString(),
  };
  expenses.push(expense);

  const openSession = getOpenCashSession();
  if (openSession && expense.date === todayISO()) {
    cashMovements.push({
      id: `cmov_${cashMovementSeq++}`,
      organizationId: ORG_ID,
      cashSessionId: openSession.id,
      type: "gasto",
      amount: -expense.amount,
      method: "efectivo",
      concept: expense.description,
      employeeId: input.employeeId,
      createdAt: expense.createdAt,
    });
  }

  logAudit(input.employeeId, "Gasto registrado", `${expense.description} — ${formatArs(expense.amount)}`);
  return expense;
}

export function addEmployee(input: { name: string; email: string; role: EmployeeRole }): Employee {
  const employee: Employee = {
    id: `emp_${employees.length + 1}`,
    organizationId: ORG_ID,
    active: true,
    ...input,
  };
  employees.push(employee);
  logAudit(getCurrentEmployee().id, "Empleado agregado", `${employee.name} (${employee.role})`);
  return employee;
}

export function updateEmployeeRole(employeeId: string, role: EmployeeRole): Employee {
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) throw new Error("Empleado no encontrado");
  employee.role = role;
  logAudit(getCurrentEmployee().id, "Rol actualizado", `${employee.name} ahora es ${role}`);
  return employee;
}

export function setEmployeeActive(employeeId: string, active: boolean): Employee {
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) throw new Error("Empleado no encontrado");
  employee.active = active;
  logAudit(getCurrentEmployee().id, active ? "Empleado reactivado" : "Empleado desactivado", employee.name);
  return employee;
}

// ---------------------------------------------------------------------------
// Fase 3 mutations: reservas recurrentes, lista de espera, fidelización,
// promociones, torneos
// ---------------------------------------------------------------------------

export function createRecurringBooking(input: {
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
    if (!isSlotAvailable(input.courtId, date, input.startTime)) {
      skipped.push(date);
      continue;
    }
    const booking = createPendingBooking({
      courtId: input.courtId,
      customerId: input.customerId,
      date,
      startTime: input.startTime,
      recurringGroupId: groupId,
    });
    payDeposit(booking.id, "mercado_pago");
    created.push(booking);
  }

  return { created, skipped };
}

export function joinWaitlist(customerId: string, courtId: string, date: string, startTime: string): WaitlistEntry {
  const existing = waitlist.find(
    (w) =>
      w.customerId === customerId &&
      w.courtId === courtId &&
      w.date === date &&
      w.startTime === startTime &&
      w.status === "esperando"
  );
  if (existing) return existing;

  const entry: WaitlistEntry = {
    id: `wl_${waitlistSeq++}`,
    organizationId: ORG_ID,
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

export function redeemLoyaltyReward(customerId: string, rewardId: string): LoyaltyRedemption {
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) throw new Error("Cliente no encontrado");
  const reward = loyaltyRewards.find((r) => r.id === rewardId);
  if (!reward) throw new Error("Beneficio no encontrado");
  if (customer.loyaltyPoints < reward.pointsCost) throw new Error("No tenés puntos suficientes");

  customer.loyaltyPoints -= reward.pointsCost;
  const redemption: LoyaltyRedemption = {
    id: `redeem_${redemptionSeq++}`,
    organizationId: ORG_ID,
    customerId,
    rewardId,
    rewardLabel: reward.label,
    pointsSpent: reward.pointsCost,
    createdAt: new Date().toISOString(),
  };
  loyaltyRedemptions.push(redemption);
  logAudit(getCurrentEmployee().id, "Canje de puntos", `${customer.name} canjeó "${reward.label}"`);
  return redemption;
}

export function createPromotion(input: Omit<Promotion, "id" | "organizationId">): Promotion {
  const promotion: Promotion = { id: `promo_${promotionSeq++}`, organizationId: ORG_ID, ...input };
  promotions.push(promotion);
  logAudit(getCurrentEmployee().id, "Promoción creada", `${promotion.label} (-${Math.round(promotion.discountPercentage * 100)}%)`);
  return promotion;
}

export function setPromotionActive(promotionId: string, active: boolean): Promotion {
  const promotion = promotions.find((p) => p.id === promotionId);
  if (!promotion) throw new Error("Promoción no encontrada");
  promotion.active = active;
  logAudit(getCurrentEmployee().id, active ? "Promoción activada" : "Promoción desactivada", promotion.label);
  return promotion;
}

export function createTournament(
  input: Omit<Tournament, "id" | "organizationId" | "status" | "createdAt">
): Tournament {
  const tournament: Tournament = {
    id: `tourn_${tournamentSeq++}`,
    organizationId: ORG_ID,
    status: "inscripcion",
    createdAt: new Date().toISOString(),
    ...input,
  };
  tournaments.push(tournament);
  logAudit(getCurrentEmployee().id, "Torneo creado", tournament.name);
  return tournament;
}

export function registerTeam(input: {
  tournamentId: string;
  name: string;
  playerNames: string[];
  customerId?: string;
}): TournamentTeam {
  const tournament = tournaments.find((t) => t.id === input.tournamentId);
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
  logAudit(getCurrentEmployee().id, "Equipo inscripto", `${team.name} en ${tournament.name}`);

  if (input.customerId) {
    notify(
      input.customerId,
      "torneo_inscripcion",
      `Inscribimos a "${team.name}" en ${tournament.name}. ¡Nos vemos el ${tournament.date}!`
    );
  }
  return team;
}

export function generateBracket(tournamentId: string): TournamentMatch[] {
  const tournament = tournaments.find((t) => t.id === tournamentId);
  if (!tournament) throw new Error("Torneo no encontrado");
  const teams = tournamentTeams.filter((t) => t.tournamentId === tournamentId);
  if (teams.length < 2) throw new Error("Necesitás al menos 2 equipos para generar el cuadro");
  if (tournamentMatches.some((m) => m.tournamentId === tournamentId)) {
    throw new Error("El cuadro ya fue generado");
  }

  const matches = generateBracketInternal(tournamentId);
  tournament.status = "en_curso";
  logAudit(getCurrentEmployee().id, "Cuadro generado", `${tournament.name} — ${teams.length} equipos`);
  return matches;
}

export function recordMatchResult(matchId: string, winnerTeamId: string, scoreLabel?: string): TournamentMatch {
  const match = tournamentMatches.find((m) => m.id === matchId);
  if (!match) throw new Error("Partido no encontrado");
  if (!match.teamAId || !match.teamBId) throw new Error("Todavía faltan equipos para este partido");
  if (winnerTeamId !== match.teamAId && winnerTeamId !== match.teamBId) throw new Error("Equipo inválido");

  match.winnerTeamId = winnerTeamId;
  match.scoreLabel = scoreLabel;
  match.status = "jugado";
  propagateWinner(match.tournamentId, match);

  const hasNextRound = tournamentMatches.some(
    (m) => m.tournamentId === match.tournamentId && m.round === match.round + 1
  );
  if (!hasNextRound) {
    const tournament = tournaments.find((t) => t.id === match.tournamentId);
    if (tournament) tournament.status = "finalizado";
  }

  const winner = tournamentTeams.find((t) => t.id === winnerTeamId);
  logAudit(getCurrentEmployee().id, "Resultado cargado", `${winner?.name ?? winnerTeamId} ganó (ronda ${match.round})`);
  return match;
}

// ---------------------------------------------------------------------------
// SaaS mutations: prueba gratis, cambio de plan, facturación
// ---------------------------------------------------------------------------

const TRIAL_DAYS = 7;

export function startTrial(planId: PlanId, billingEmail: string): Organization {
  organization.plan = planId;
  organization.subscriptionStatus = "trialing";
  organization.billingEmail = billingEmail;
  organization.trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  organization.currentPeriodEnd = undefined;
  logAudit(getCurrentEmployee().id, "Prueba gratis iniciada", `Plan ${planId} · ${TRIAL_DAYS} días · ${billingEmail}`);
  return organization;
}

export function changePlan(planId: PlanId): Organization {
  const previous = organization.plan;
  organization.plan = planId;
  logAudit(getCurrentEmployee().id, "Plan cambiado", `${previous} → ${planId}`);
  return organization;
}

// Simula el checkout de Mercado Pago Suscripciones: siempre aprobado, como el
// resto de los pagos de esta demo. Reemplazar por la preferencia/webhook real
// de MP cuando haya credenciales.
export function activateSubscription(billingEmail: string): Organization {
  const plan = getPlan(organization.plan);
  if (!plan) throw new Error("Plan inválido");

  organization.subscriptionStatus = "active";
  organization.billingEmail = billingEmail;
  organization.trialEndsAt = undefined;
  organization.currentPeriodEnd = addDaysISO(todayISO(), 30);
  organization.mercadopagoSubscriptionId = organization.mercadopagoSubscriptionId ?? `mp_sub_${Date.now()}`;

  billingInvoices.push({
    id: `inv_${billingInvoiceSeq++}`,
    organizationId: ORG_ID,
    plan: plan.id,
    amountUSD: plan.priceUSD,
    status: "pagada",
    periodStart: todayISO(),
    periodEnd: organization.currentPeriodEnd,
    createdAt: new Date().toISOString(),
  });

  logAudit(getCurrentEmployee().id, "Suscripción activada", `Plan ${plan.name} — USD ${plan.priceUSD}/mes`);
  return organization;
}

export function cancelSubscription(): Organization {
  organization.subscriptionStatus = "canceled";
  logAudit(getCurrentEmployee().id, "Suscripción cancelada", `Plan ${organization.plan}`);
  return organization;
}

// Solo para poder mostrar en la demo cómo se ve el paywall sin esperar 7 días reales.
export function simulateTrialExpired(): Organization {
  if (organization.subscriptionStatus === "trialing") {
    organization.trialEndsAt = addDaysISO(todayISO(), -1);
  }
  return organization;
}

// The mock session: everything in this MVP acts as this logged-in customer
// until real Supabase Auth replaces it.
export function getCurrentCustomer(): Customer {
  return customers[0];
}
