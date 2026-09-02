"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  activateSubscription,
  addEmployee,
  addExpense,
  adjustStock,
  adminChangePlan,
  adminSetSubscriptionStatus,
  cancelSubscription,
  changePlan,
  closeCashSession,
  collectBalance,
  createCourt,
  createOrganization,
  createPendingBooking,
  createPromotion,
  createRecurringBooking,
  createSale,
  createTournament,
  findOrCreateGuestCustomer,
  generateBracket,
  joinWaitlist,
  openCashSession,
  payDeposit,
  recordMatchResult,
  redeemLoyaltyReward,
  registerTeam,
  setEmployeeActive,
  setPromotionActive,
  simulateTrialExpired,
  updateBookingStatus,
  updateEmployeeRole,
  verifyEmployeeCredentials,
  verifyPlatformAdminCredentials,
} from "./db";
import {
  clearEmployeeSession,
  clearSuperadminSession,
  getCustomerSession,
  newSessionToken,
  requireEmployeeSession,
  requireSuperadminSession,
  setCustomerSession,
  setEmployeeSession,
  setSuperadminSession,
} from "./session";
import type {
  BookingPayment,
  BookingStatus,
  CourtSurface,
  EmployeeRole,
  ExpenseCategory,
  PaymentMethod,
  PlanId,
  Sport,
  SubscriptionStatus,
} from "./types";

type GuestContact = { name: string; email: string; phone: string };

async function identifyGuest(organizationId: string, contact: GuestContact) {
  const customer = findOrCreateGuestCustomer(organizationId, contact);
  const token = newSessionToken({ kind: "customer", customerId: customer.id, organizationId });
  await setCustomerSession(organizationId, token);
  return customer;
}

function revalidateEverywhere() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Auth — login/logout de dueños, registro de una cuenta nueva, superadmin
// ---------------------------------------------------------------------------

export async function loginAction(email: string, password: string): Promise<{ error: string } | void> {
  const employee = verifyEmployeeCredentials(email, password);
  if (!employee) return { error: "Email o contraseña incorrectos" };
  const token = newSessionToken({ kind: "employee", employeeId: employee.id, organizationId: employee.organizationId });
  await setEmployeeSession(token);
  redirect("/admin");
}

export async function logoutAction() {
  await clearEmployeeSession();
  redirect("/");
}

export async function signupAction(input: {
  orgName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  planId: PlanId;
}): Promise<{ error: string } | void> {
  let organization, owner;
  try {
    ({ organization, owner } = createOrganization({
      name: input.orgName,
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail,
      ownerPassword: input.ownerPassword,
      planId: input.planId,
    }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la cuenta" };
  }
  const token = newSessionToken({ kind: "employee", employeeId: owner.id, organizationId: organization.id });
  await setEmployeeSession(token);
  redirect("/admin");
}

export async function superadminLoginAction(email: string, password: string): Promise<{ error: string } | void> {
  const admin = verifyPlatformAdminCredentials(email, password);
  if (!admin) return { error: "Email o contraseña incorrectos" };
  const token = newSessionToken({ kind: "superadmin", adminId: admin.id });
  await setSuperadminSession(token);
  redirect("/superadmin");
}

export async function superadminLogoutAction() {
  await clearSuperadminSession();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Reservas (cliente público, identificado como invitado por email)
// ---------------------------------------------------------------------------

// Books a slot and immediately marks the deposit as paid, simulating an
// approved Mercado Pago checkout. Swap the `payDeposit` call for a real
// Mercado Pago preference + webhook once MERCADOPAGO_ACCESS_TOKEN is set.
// `weeks` > 1 books the same day/time on the following weeks too ("reserva recurrente").
export async function reserveSlotAction(input: {
  organizationId: string;
  courtId: string;
  date: string;
  startTime: string;
  weeks?: number;
  contact: GuestContact;
}) {
  const customer = await identifyGuest(input.organizationId, input.contact);
  revalidateEverywhere();

  if (input.weeks && input.weeks > 1) {
    const { created, skipped } = createRecurringBooking(input.organizationId, {
      courtId: input.courtId,
      customerId: customer.id,
      startDate: input.date,
      startTime: input.startTime,
      weeks: input.weeks,
    });
    if (created.length === 0) throw new Error("Ese horario ya no está disponible");
    return { bookingId: created[0].id, createdCount: created.length, skippedDates: skipped };
  }

  const booking = createPendingBooking(input.organizationId, {
    courtId: input.courtId,
    customerId: customer.id,
    date: input.date,
    startTime: input.startTime,
  });
  payDeposit(input.organizationId, booking.id, "mercado_pago");
  return { bookingId: booking.id, createdCount: 1, skippedDates: [] };
}

export async function collectBalanceAction(bookingId: string, method: BookingPayment["method"]) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  collectBalance(organizationId, employeeId, bookingId, method);
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function setBookingStatusAction(bookingId: string, status: BookingStatus) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  updateBookingStatus(organizationId, employeeId, bookingId, status);
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/admin/auditoria");
}

// ---------------------------------------------------------------------------
// Fase 2 — Caja, ventas, gastos, empleados
// ---------------------------------------------------------------------------

export async function openCashSessionAction(openingAmount: number) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  openCashSession(organizationId, employeeId, openingAmount);
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function closeCashSessionAction(sessionId: string, countedAmount: number) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  closeCashSession(organizationId, employeeId, sessionId, countedAmount);
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function createSaleAction(input: {
  items: { productId: string; quantity: number }[];
  method: PaymentMethod;
}) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  const sale = createSale(organizationId, { employeeId, items: input.items, method: input.method });

  revalidatePath("/admin/caja");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  revalidatePath("/admin/auditoria");

  return sale.id;
}

export async function adjustStockAction(productId: string, delta: number, reason: string) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  adjustStock(organizationId, employeeId, productId, delta, reason);
  revalidatePath("/admin/inventario");
  revalidatePath("/admin/auditoria");
}

export async function createCourtAction(input: {
  name: string;
  sport: Sport;
  surface: CourtSurface;
  indoor: boolean;
  lighting: boolean;
  slotMinutes: number;
  openTime: string;
  closeTime: string;
  basePrice: number;
}) {
  const { organizationId } = await requireEmployeeSession();
  createCourt(organizationId, input);
  revalidatePath("/admin/canchas");
}

export async function addExpenseAction(input: {
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  addExpense(organizationId, { ...input, employeeId });

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/caja");
  revalidatePath("/admin/auditoria");
}

export async function addEmployeeAction(input: { name: string; email: string; role: EmployeeRole; password: string }) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  addEmployee(organizationId, employeeId, input);
  revalidatePath("/admin/empleados");
  revalidatePath("/admin/auditoria");
}

export async function updateEmployeeRoleAction(employeeId: string, role: EmployeeRole) {
  const { organizationId, employeeId: actorId } = await requireEmployeeSession();
  updateEmployeeRole(organizationId, actorId, employeeId, role);
  revalidatePath("/admin/empleados");
  revalidatePath("/admin/auditoria");
}

export async function setEmployeeActiveAction(employeeId: string, active: boolean) {
  const { organizationId, employeeId: actorId } = await requireEmployeeSession();
  setEmployeeActive(organizationId, actorId, employeeId, active);
  revalidatePath("/admin/empleados");
  revalidatePath("/admin/auditoria");
}

// ---------------------------------------------------------------------------
// Fase 3 — Lista de espera, fidelización, promociones, torneos
// ---------------------------------------------------------------------------

export async function joinWaitlistAction(organizationId: string, courtId: string, date: string, startTime: string, contact: GuestContact) {
  const customer = await identifyGuest(organizationId, contact);
  joinWaitlist(organizationId, customer.id, courtId, date, startTime);
  revalidateEverywhere();
}

export async function redeemRewardAction(organizationId: string, rewardId: string) {
  const session = await getCustomerSession(organizationId);
  if (!session) throw new Error("No pudimos identificarte");
  redeemLoyaltyReward(organizationId, session.customerId, rewardId);
  revalidateEverywhere();
}

export async function createPromotionAction(input: {
  label: string;
  discountPercentage: number;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  sports?: Sport[];
}) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  createPromotion(organizationId, employeeId, { ...input, active: true });
  revalidatePath("/admin/promociones");
  revalidatePath("/admin/auditoria");
}

export async function setPromotionActiveAction(promotionId: string, active: boolean) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  setPromotionActive(organizationId, employeeId, promotionId, active);
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
  const { organizationId, employeeId } = await requireEmployeeSession();
  const tournament = createTournament(organizationId, employeeId, input);
  revalidatePath("/admin/torneos");
  revalidateEverywhere();
  return tournament.id;
}

// Usado tanto desde el panel admin (organizationId conocido por sesión) como
// desde el sitio público del cliente (organizationId conocido por el slug de
// la URL) — por eso lo recibe como parámetro en vez de resolverlo de la sesión.
export async function registerTeamAction(input: {
  organizationId: string;
  tournamentId: string;
  name: string;
  playerNames: string[];
  contact?: GuestContact;
}) {
  const customer = input.contact ? await identifyGuest(input.organizationId, input.contact) : undefined;
  registerTeam(input.organizationId, {
    tournamentId: input.tournamentId,
    name: input.name,
    playerNames: input.playerNames,
    customerId: customer?.id,
  });
  revalidatePath(`/admin/torneos/${input.tournamentId}`);
  revalidatePath("/admin/auditoria");
  revalidateEverywhere();
}

export async function generateBracketAction(tournamentId: string) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  generateBracket(organizationId, employeeId, tournamentId);
  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/torneos");
  revalidateEverywhere();
}

export async function recordMatchResultAction(matchId: string, winnerTeamId: string, scoreLabel: string, tournamentId: string) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  recordMatchResult(organizationId, employeeId, matchId, winnerTeamId, scoreLabel || undefined);
  revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/admin/ranking");
  revalidatePath("/admin/auditoria");
  revalidateEverywhere();
}

// ---------------------------------------------------------------------------
// SaaS — cambio de plan, facturación de la propia cuenta
// ---------------------------------------------------------------------------

export async function changePlanAction(planId: PlanId) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  changePlan(organizationId, employeeId, planId);
  revalidateEverywhere();
}

export async function activateSubscriptionAction(billingEmail: string) {
  const { organizationId, employeeId } = await requireEmployeeSession();
  activateSubscription(organizationId, employeeId, billingEmail);
  revalidateEverywhere();
}

export async function cancelSubscriptionAction() {
  const { organizationId, employeeId } = await requireEmployeeSession();
  cancelSubscription(organizationId, employeeId);
  revalidateEverywhere();
}

export async function simulateTrialExpiredAction() {
  const { organizationId } = await requireEmployeeSession();
  simulateTrialExpired(organizationId);
  revalidateEverywhere();
}

// ---------------------------------------------------------------------------
// Superadmin — gestión de todas las organizaciones
// ---------------------------------------------------------------------------

export async function superadminChangePlanAction(organizationId: string, planId: PlanId) {
  await requireSuperadminSession();
  adminChangePlan(organizationId, planId);
  revalidatePath("/superadmin/organizaciones");
  revalidatePath(`/superadmin/organizaciones/${organizationId}`);
}

export async function superadminSetStatusAction(organizationId: string, status: SubscriptionStatus) {
  await requireSuperadminSession();
  adminSetSubscriptionStatus(organizationId, status);
  revalidatePath("/superadmin/organizaciones");
  revalidatePath(`/superadmin/organizaciones/${organizationId}`);
}
