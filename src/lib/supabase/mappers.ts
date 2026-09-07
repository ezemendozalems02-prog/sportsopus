// Mapeo snake_case (filas de Postgres) <-> camelCase (tipos de src/lib/types.ts).
// Los tipos de dominio no cambian — solo de dónde vienen los datos.
import type {
  AuditLogEntry, Booking, BookingPayment, CashMovement, CashRegisterSession,
  Court, Customer, Employee, Expense, LoyaltyRedemption, LoyaltyReward,
  NotificationEntry, Organization, PriceRule, Product, ProductCategory,
  Promotion, Sale, SaleItem, Tournament, TournamentMatch, TournamentTeam,
  WaitlistEntry, BillingInvoice,
} from "../types";

// Fila cruda de PostgREST — su forma exacta depende del select() de cada
// query (incluidos los joins anidados), así que tiparla más estricto que
// esto no aportaría seguridad real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

// "08:00:00" (Postgres time) -> "08:00" (formato usado en toda la app).
export function normTime(t: string): string {
  return t.slice(0, 5);
}

export function mapOrganization(r: Row): Organization {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    depositPercentage: Number(r.deposit_percentage),
    timezone: r.timezone,
    plan: r.plan,
    subscriptionStatus: r.subscription_status,
    billingEmail: r.billing_email ?? undefined,
    trialEndsAt: r.trial_ends_at ?? undefined,
    currentPeriodEnd: r.current_period_end ?? undefined,
    mercadopagoSubscriptionId: r.mercadopago_subscription_id ?? undefined,
    paymentAlias: r.payment_alias ?? undefined,
    whatsappNumber: r.whatsapp_number ?? undefined,
  };
}

export function mapEmployee(r: Row): Employee {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    email: r.email,
    role: r.role,
    active: r.active,
  };
}

export function mapCustomer(r: Row): Customer {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? "",
    favoriteSport: r.favorite_sport ?? undefined,
    loyaltyPoints: r.loyalty_points,
  };
}

export function mapPriceRule(r: Row): PriceRule {
  return {
    id: r.id,
    label: r.label,
    daysOfWeek: r.days_of_week,
    startTime: normTime(r.start_time),
    endTime: normTime(r.end_time),
    pricePerSlot: Number(r.price_per_slot),
  };
}

export function mapCourt(r: Row): Court {
  const rules = (r.court_price_rules ?? []) as Row[];
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    sport: r.sport,
    surface: r.surface,
    indoor: r.indoor,
    lighting: r.lighting,
    slotMinutes: r.slot_minutes,
    openTime: normTime(r.open_time),
    closeTime: normTime(r.close_time),
    daysOpen: r.days_open,
    priceRules: rules.map(mapPriceRule),
    active: r.active,
  };
}

export function mapBookingPayment(r: Row): BookingPayment {
  return {
    id: r.id,
    bookingId: r.booking_id,
    concept: r.concept,
    amount: Number(r.amount),
    method: r.method,
    status: r.status,
    paidAt: r.paid_at,
  };
}

export function mapBooking(r: Row): Booking {
  const payments = (r.booking_payments ?? []) as Row[];
  return {
    id: r.id,
    organizationId: r.organization_id,
    courtId: r.court_id,
    customerId: r.customer_id,
    date: r.date,
    startTime: normTime(r.start_time),
    endTime: normTime(r.end_time),
    totalPrice: Number(r.total_price),
    depositAmount: Number(r.deposit_amount),
    balanceAmount: Number(r.balance_amount),
    status: r.status,
    payments: payments.map(mapBookingPayment),
    createdAt: r.created_at,
    recurringGroupId: r.recurring_group_id ?? undefined,
    discountLabel: r.discount_label ?? undefined,
  };
}

export function mapProductCategory(r: Row): ProductCategory {
  return { id: r.id, organizationId: r.organization_id, name: r.name };
}

export function mapProduct(r: Row): Product {
  return {
    id: r.id,
    organizationId: r.organization_id,
    categoryId: r.category_id,
    name: r.name,
    sku: r.sku,
    cost: Number(r.cost),
    price: Number(r.price),
    stock: r.stock,
    minStock: r.min_stock,
    active: r.active,
  };
}

export function mapCashSession(r: Row): CashRegisterSession {
  return {
    id: r.id,
    organizationId: r.organization_id,
    employeeId: r.employee_id,
    status: r.status,
    openingAmount: Number(r.opening_amount),
    openedAt: r.opened_at,
    closingCountedAmount: r.closing_counted_amount != null ? Number(r.closing_counted_amount) : undefined,
    closedAt: r.closed_at ?? undefined,
  };
}

export function mapCashMovement(r: Row): CashMovement {
  return {
    id: r.id,
    organizationId: r.organization_id,
    cashSessionId: r.cash_session_id,
    type: r.type,
    amount: Number(r.amount),
    method: r.method,
    concept: r.concept,
    employeeId: r.employee_id,
    createdAt: r.created_at,
  };
}

export function mapSaleItem(r: Row): SaleItem {
  return { productId: r.product_id, name: r.name, quantity: r.quantity, unitPrice: Number(r.unit_price) };
}

export function mapSale(r: Row): Sale {
  const items = (r.sale_items ?? []) as Row[];
  return {
    id: r.id,
    organizationId: r.organization_id,
    cashSessionId: r.cash_session_id ?? null,
    employeeId: r.employee_id,
    items: items.map(mapSaleItem),
    total: Number(r.total),
    method: r.method,
    createdAt: r.created_at,
  };
}

export function mapExpense(r: Row): Expense {
  return {
    id: r.id,
    organizationId: r.organization_id,
    employeeId: r.employee_id,
    category: r.category,
    description: r.description,
    amount: Number(r.amount),
    date: r.date,
    createdAt: r.created_at,
  };
}

export function mapAuditLog(r: Row): AuditLogEntry {
  return {
    id: r.id,
    organizationId: r.organization_id,
    employeeId: r.employee_id ?? "system",
    employeeName: r.employees?.name ?? "Sistema",
    action: r.action,
    detail: r.detail,
    createdAt: r.created_at,
  };
}

export function mapPromotion(r: Row): Promotion {
  return {
    id: r.id,
    organizationId: r.organization_id,
    label: r.label,
    discountPercentage: Number(r.discount_percentage),
    daysOfWeek: r.days_of_week,
    startTime: normTime(r.start_time),
    endTime: normTime(r.end_time),
    sports: r.sports ?? undefined,
    active: r.active,
  };
}

export function mapLoyaltyReward(r: Row): LoyaltyReward {
  return { id: r.id, label: r.label, pointsCost: r.points_cost, kind: r.kind };
}

export function mapLoyaltyRedemption(r: Row): LoyaltyRedemption {
  return {
    id: r.id,
    organizationId: r.organization_id,
    customerId: r.customer_id,
    rewardId: r.reward_id,
    rewardLabel: r.loyalty_rewards?.label ?? "",
    pointsSpent: r.points_spent,
    createdAt: r.created_at,
  };
}

export function mapWaitlistEntry(r: Row): WaitlistEntry {
  return {
    id: r.id,
    organizationId: r.organization_id,
    customerId: r.customer_id,
    courtId: r.court_id,
    date: r.date,
    startTime: normTime(r.start_time),
    status: r.status,
    createdAt: r.created_at,
    notifiedAt: r.notified_at ?? undefined,
  };
}

export function mapNotification(r: Row): NotificationEntry {
  return {
    id: r.id,
    organizationId: r.organization_id,
    customerId: r.customer_id,
    channel: r.channel,
    kind: r.kind,
    message: r.message,
    createdAt: r.created_at,
  };
}

export function mapTournament(r: Row): Tournament {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    sport: r.sport,
    category: r.category,
    date: r.date,
    maxTeams: r.max_teams,
    entryFee: Number(r.entry_fee),
    prize: r.prize,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function mapTournamentTeam(r: Row): TournamentTeam {
  return {
    id: r.id,
    tournamentId: r.tournament_id,
    name: r.name,
    playerNames: r.player_names,
    customerId: r.customer_id ?? undefined,
    paidEntry: r.paid_entry,
    registeredAt: r.registered_at,
  };
}

export function mapTournamentMatch(r: Row): TournamentMatch {
  return {
    id: r.id,
    tournamentId: r.tournament_id,
    round: r.round,
    matchIndex: r.match_index,
    teamAId: r.team_a_id ?? undefined,
    teamBId: r.team_b_id ?? undefined,
    scoreLabel: r.score_label ?? undefined,
    winnerTeamId: r.winner_team_id ?? undefined,
    status: r.status,
  };
}

export function mapBillingInvoice(r: Row): BillingInvoice {
  return {
    id: r.id,
    organizationId: r.organization_id,
    plan: r.plan,
    amountARS: Number(r.amount_usd),
    status: r.status,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    createdAt: r.created_at,
  };
}
