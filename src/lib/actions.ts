"use server";

import { revalidatePath } from "next/cache";
import {
  activateSubscription,
  addEmployee,
  addExpense,
  adjustStock,
  cancelSubscription,
  changePlan,
  closeCashSession,
  collectBalance,
  createPendingBooking,
  createPromotion,
  createRecurringBooking,
  createSale,
  createTournament,
  generateBracket,
  getCurrentCustomer,
  getCurrentEmployee,
  joinWaitlist,
  openCashSession,
  payDeposit,
  recordMatchResult,
  redeemLoyaltyReward,
  registerTeam,
  setEmployeeActive,
  setPromotionActive,
  simulateTrialExpired,
  startTrial,
  updateBookingStatus,
  updateEmployeeRole,
} from "./db";
import type {
  BookingPayment,
  BookingStatus,
  EmployeeRole,
  ExpenseCategory,
  PaymentMethod,
  PlanId,
  Sport,
} from "./types";

// Books a slot and immediately marks the deposit as paid, simulating an
// approved Mercado Pago checkout. Swap the `payDeposit` call for a real
// Mercado Pago preference + webhook once MERCADOPAGO_ACCESS_TOKEN is set.
// `weeks` > 1 books the same day/time on the following weeks too ("reserva recurrente").
export async function reserveSlotAction(input: {
  courtId: string;
  date: string;
  startTime: string;
  weeks?: number;
}) {
  const customer = getCurrentCustomer();

  revalidatePath("/reservar");
  revalidatePath("/mis-reservas");
  revalidatePath("/admin");
  revalidatePath("/admin/agenda");

  if (input.weeks && input.weeks > 1) {
    const { created, skipped } = createRecurringBooking({
      courtId: input.courtId,
      customerId: customer.id,
      startDate: input.date,
      startTime: input.startTime,
      weeks: input.weeks,
    });
    if (created.length === 0) throw new Error("Ese horario ya no está disponible");
    return { bookingId: created[0].id, createdCount: created.length, skippedDates: skipped };
  }

  const booking = createPendingBooking({ ...input, customerId: customer.id });
  payDeposit(booking.id, "mercado_pago");
  return { bookingId: booking.id, createdCount: 1, skippedDates: [] };
}

export async function collectBalanceAction(bookingId: string, method: BookingPayment["method"]) {
  collectBalance(bookingId, method);
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function setBookingStatusAction(bookingId: string, status: BookingStatus) {
  updateBookingStatus(bookingId, status);
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/admin/auditoria");
}

// ---------------------------------------------------------------------------
// Fase 2 — Caja, ventas, gastos, empleados
// ---------------------------------------------------------------------------

export async function openCashSessionAction(openingAmount: number) {
  const employee = getCurrentEmployee();
  openCashSession(employee.id, openingAmount);
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function closeCashSessionAction(sessionId: string, countedAmount: number) {
  closeCashSession(sessionId, countedAmount);
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function createSaleAction(input: {
  items: { productId: string; quantity: number }[];
  method: PaymentMethod;
}) {
  const employee = getCurrentEmployee();
  const sale = createSale({ employeeId: employee.id, items: input.items, method: input.method });

  revalidatePath("/admin/caja");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  revalidatePath("/admin/auditoria");

  return sale.id;
}

export async function adjustStockAction(productId: string, delta: number, reason: string) {
  adjustStock(productId, delta, reason);
  revalidatePath("/admin/inventario");
  revalidatePath("/admin/auditoria");
}

export async function addExpenseAction(input: {
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}) {
  const employee = getCurrentEmployee();
  addExpense({ ...input, employeeId: employee.id });

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function addEmployeeAction(input: { name: string; email: string; role: EmployeeRole }) {
  addEmployee(input);
  revalidatePath("/admin/empleados");
  revalidatePath("/admin/auditoria");
}

export async function updateEmployeeRoleAction(employeeId: string, role: EmployeeRole) {
  updateEmployeeRole(employeeId, role);
  revalidatePath("/admin/empleados");
  revalidatePath("/admin/auditoria");
}

export async function setEmployeeActiveAction(employeeId: string, active: boolean) {
  setEmployeeActive(employeeId, active);
  revalidatePath("/admin/empleados");
  revalidatePath("/admin/auditoria");
}

// ---------------------------------------------------------------------------
// Fase 3 — Lista de espera, fidelización, promociones, torneos
// ---------------------------------------------------------------------------

export async function joinWaitlistAction(courtId: string, date: string, startTime: string) {
  const customer = getCurrentCustomer();
  joinWaitlist(customer.id, courtId, date, startTime);
  revalidatePath("/reservar");
  revalidatePath("/mis-reservas");
}

export async function redeemRewardAction(rewardId: string) {
  const customer = getCurrentCustomer();
  redeemLoyaltyReward(customer.id, rewardId);
  revalidatePath("/beneficios");
  revalidatePath("/admin/auditoria");
}

export async function createPromotionAction(input: {
  label: string;
  discountPercentage: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  sports?: Sport[];
}) {
  createPromotion({ ...input, active: true });
  revalidatePath("/admin/promociones");
  revalidatePath("/admin/auditoria");
}

export async function setPromotionActiveAction(promotionId: string, active: boolean) {
  setPromotionActive(promotionId, active);
  revalidatePath("/admin/promociones");
  revalidatePath("/admin/auditoria");
}

export async function createTournamentAction(input: {
  name: string;
  sport: Sport;
  category: string;
  date: string;
  maxTeams: number;
  entryFee: number;
  prize: string;
}) {
  const tournament = createTournament(input);
  revalidatePath("/admin/torneos");
  revalidatePath("/torneos");
  revalidatePath("/admin/auditoria");
  return tournament.id;
}

export async function registerTeamAction(input: {
  tournamentId: string;
  name: string;
  playerNames: string[];
  asCurrentCustomer?: boolean;
}) {
  const customer = getCurrentCustomer();
  registerTeam({
    tournamentId: input.tournamentId,
    name: input.name,
    playerNames: input.playerNames,
    customerId: input.asCurrentCustomer ? customer.id : undefined,
  });
  revalidatePath(`/admin/torneos/${input.tournamentId}`);
  revalidatePath(`/torneos/${input.tournamentId}`);
  revalidatePath("/admin/auditoria");
}

export async function generateBracketAction(tournamentId: string) {
  generateBracket(tournamentId);
  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath(`/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
}

export async function recordMatchResultAction(matchId: string, winnerTeamId: string, scoreLabel: string, tournamentId: string) {
  recordMatchResult(matchId, winnerTeamId, scoreLabel || undefined);
  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath(`/torneos/${tournamentId}`);
  revalidatePath("/admin/ranking");
  revalidatePath("/admin/auditoria");
}

// ---------------------------------------------------------------------------
// SaaS — prueba gratis, planes, facturación
// ---------------------------------------------------------------------------

function revalidateEverywhere() {
  revalidatePath("/", "layout");
}

export async function startTrialAction(planId: PlanId, billingEmail: string) {
  startTrial(planId, billingEmail);
  revalidateEverywhere();
}

export async function changePlanAction(planId: PlanId) {
  changePlan(planId);
  revalidateEverywhere();
}

export async function activateSubscriptionAction(billingEmail: string) {
  activateSubscription(billingEmail);
  revalidateEverywhere();
}

export async function cancelSubscriptionAction() {
  cancelSubscription();
  revalidateEverywhere();
}

export async function simulateTrialExpiredAction() {
  simulateTrialExpired();
  revalidateEverywhere();
}
