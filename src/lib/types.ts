// Core domain types for SportControl.
// Every tenant-owned record carries organizationId so the same shapes map
// 1:1 onto the future Supabase schema (see supabase/migrations/0001_init.sql).

export type Sport = "padel" | "futbol5" | "futbol8" | "futbol11";

export type CourtSurface = "sintetico" | "cemento" | "polvo_de_ladrillo" | "parquet";

export type PlanId = "starter" | "pro" | "business";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  depositPercentage: number; // e.g. 0.3 = seña del 30%
  timezone: string;
  plan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  billingEmail?: string;
  trialEndsAt?: string; // ISO datetime — solo relevante si subscriptionStatus === "trialing"
  currentPeriodEnd?: string; // ISO datetime — próximo cobro, si subscriptionStatus === "active"
  mercadopagoSubscriptionId?: string;
  paymentAlias?: string; // alias/CBU para que el cliente transfiera la seña
  whatsappNumber?: string; // wa.me del club, para mandar el comprobante
}

export interface PriceRule {
  id: string;
  label: string; // "Hora valle", "Hora pico", "Fin de semana"
  daysOfWeek: number[]; // 0=domingo ... 6=sábado
  startTime: string; // "08:00"
  endTime: string; // "17:00"
  pricePerSlot: number;
}

export interface Court {
  id: string;
  organizationId: string;
  name: string;
  sport: Sport;
  surface: CourtSurface;
  indoor: boolean;
  lighting: boolean;
  slotMinutes: number; // duración estándar del turno
  openTime: string; // "08:00"
  closeTime: string; // "23:00"
  daysOpen: number[]; // 0=domingo ... 6=sábado
  priceRules: PriceRule[];
  active: boolean;
}

export type BookingStatus =
  | "pendiente_pago"
  | "sena_pagada"
  | "confirmada"
  | "en_curso"
  | "finalizada"
  | "cancelada"
  | "no_show";

export type PaymentMethod = "mercado_pago" | "efectivo" | "transferencia" | "tarjeta" | "otro";

export interface BookingPayment {
  id: string;
  bookingId: string;
  concept: "sena" | "saldo" | "pago_completo";
  amount: number;
  method: PaymentMethod;
  status: "aprobado" | "pendiente" | "rechazado";
  paidAt: string; // ISO datetime
}

export interface Booking {
  id: string;
  organizationId: string;
  courtId: string;
  customerId: string;
  date: string; // "2026-09-05"
  startTime: string; // "18:00"
  endTime: string; // "19:30"
  totalPrice: number;
  depositAmount: number;
  balanceAmount: number;
  status: BookingStatus;
  payments: BookingPayment[];
  createdAt: string;
  recurringGroupId?: string; // links occurrences created together via "reserva recurrente"
  discountLabel?: string; // e.g. "Happy Hour -20%", set when a promotion applied
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  favoriteSport?: Sport;
  loyaltyPoints: number;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  price: number;
  basePrice: number; // pre-promoción, para mostrar el precio tachado
  discountLabel?: string;
  available: boolean;
  bookingId?: string;
}

export type EmployeeRole = "owner" | "admin" | "cajero";

export interface Employee {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: EmployeeRole;
  active: boolean;
}

// Platform owner (SportControl staff), not tied to any tenant organization.
export interface PlatformAdmin {
  id: string;
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Fase 2 — Operación: productos, inventario, caja/POS, gastos, auditoría
// ---------------------------------------------------------------------------

export interface ProductCategory {
  id: string;
  organizationId: string;
  name: string;
}

export interface Product {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  sku: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  active: boolean;
}

export interface SaleItem {
  productId: string;
  name: string; // snapshot at time of sale, survives later price/name edits
  quantity: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  organizationId: string;
  cashSessionId: string | null;
  employeeId: string;
  items: SaleItem[];
  total: number;
  method: PaymentMethod;
  createdAt: string;
}

export type CashMovementType = "venta" | "cobro_reserva" | "ingreso_manual" | "egreso_manual" | "gasto";

export interface CashMovement {
  id: string;
  organizationId: string;
  cashSessionId: string;
  type: CashMovementType;
  amount: number; // positive = entra a la caja, negative = sale de la caja
  method: PaymentMethod;
  concept: string;
  employeeId: string;
  createdAt: string;
}

export type CashSessionStatus = "abierta" | "cerrada";

export interface CashRegisterSession {
  id: string;
  organizationId: string;
  employeeId: string;
  status: CashSessionStatus;
  openingAmount: number;
  openedAt: string;
  closingCountedAmount?: number;
  closedAt?: string;
}

export type ExpenseCategory =
  | "luz" | "agua" | "alquiler" | "sueldos" | "mantenimiento"
  | "insumos" | "limpieza" | "publicidad" | "reparaciones" | "otro";

export interface Expense {
  id: string;
  organizationId: string;
  employeeId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string; // "2026-09-05"
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  employeeId: string;
  employeeName: string;
  action: string;
  detail: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Fase 3 — Crecimiento: torneos, ranking, fidelización, promociones,
// lista de espera, reservas recurrentes, notificaciones
// ---------------------------------------------------------------------------

export type TournamentStatus = "inscripcion" | "en_curso" | "finalizado";

export interface Tournament {
  id: string;
  organizationId: string;
  name: string;
  sport: Sport;
  category: string; // "8va", "Libre", etc.
  date: string;
  maxTeams: number; // cupos — potencia de 2 (8, 16, 32)
  entryFee: number;
  prize: string;
  status: TournamentStatus;
  createdAt: string;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string; // "Juan / Martín"
  playerNames: string[];
  customerId?: string;
  paidEntry: boolean;
  registeredAt: string;
}

export type TournamentMatchStatus = "pendiente" | "bye" | "jugado";

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number; // 1 = primera ronda
  matchIndex: number; // posición dentro de la ronda
  teamAId?: string;
  teamBId?: string;
  scoreLabel?: string; // "6-4 4-6 10-7", texto libre
  winnerTeamId?: string;
  status: TournamentMatchStatus;
}

export interface RankingEntry {
  playerName: string;
  points: number;
  wins: number;
  titles: number;
}

export type LoyaltyRewardKind = "descuento" | "producto" | "hora_bonificada";

export interface LoyaltyReward {
  id: string;
  label: string;
  pointsCost: number;
  kind: LoyaltyRewardKind;
}

export interface LoyaltyRedemption {
  id: string;
  organizationId: string;
  customerId: string;
  rewardId: string;
  rewardLabel: string;
  pointsSpent: number;
  createdAt: string;
}

export interface Promotion {
  id: string;
  organizationId: string;
  label: string; // "Happy Hour"
  discountPercentage: number; // 0.2 = 20% off
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  sports?: Sport[]; // si está vacío/undefined, aplica a todos los deportes
  active: boolean;
}

export type WaitlistStatus = "esperando" | "notificado" | "expirado" | "reservado";

export interface WaitlistEntry {
  id: string;
  organizationId: string;
  customerId: string;
  courtId: string;
  date: string;
  startTime: string;
  status: WaitlistStatus;
  createdAt: string;
  notifiedAt?: string;
}

export type NotificationChannel = "whatsapp" | "email";
export type NotificationKind =
  | "reserva_confirmada"
  | "recordatorio"
  | "cancelacion"
  | "lista_espera_liberada"
  | "torneo_inscripcion";

export interface NotificationEntry {
  id: string;
  organizationId: string;
  customerId: string;
  channel: NotificationChannel;
  kind: NotificationKind;
  message: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SaaS — planes, prueba gratis y facturación
// ---------------------------------------------------------------------------

export type PlanFeatureGroup = "operacion" | "crecimiento" | "inteligencia";

export interface Plan {
  id: PlanId;
  name: string;
  priceARS: number;
  priceUSD: number; // referencia aproximada, usada solo en reportes internos
  tagline: string;
  featureGroups: PlanFeatureGroup[]; // qué secciones del panel desbloquea
  highlights: string[]; // bullets para la página de precios
  mpPreapprovalPlanId?: string; // id del "preapproval_plan" de Mercado Pago
  mpCheckoutUrl?: string; // link de checkout de suscripción de ese plan
}

export type InvoiceStatus = "pagada" | "pendiente" | "fallida";

export interface BillingInvoice {
  id: string;
  organizationId: string;
  plan: PlanId;
  amountARS: number;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}
