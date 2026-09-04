import Link from "next/link";
import { AlertTriangle, ArrowUpRight, TrendingUp } from "lucide-react";
import {
  computeDailyRevenue,
  getCustomer,
  getOpenCashSession,
  getSlotsForCourt,
  hasFeatureAccess,
  listBookingsForDate,
  listCourts,
  listLowStockProducts,
  listSales,
  listTeamsForTournament,
  listTournaments,
} from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import type { Booking } from "@/lib/types";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { formatDateLong, todayISO } from "@/lib/time";
import { Card, OccupancyBar, StatTile, StatusBadge } from "@/components/ui";
import { RevenueTrendChart } from "@/components/charts";

function paymentsTotal(bookings: Booking[]) {
  return bookings.reduce((sum, b) => sum + b.payments.reduce((s, p) => s + p.amount, 0), 0);
}

export default async function AdminDashboardPage() {
  const { organizationId } = await requireEmployeeSession();
  const today = todayISO();
  const hasOperacion = await hasFeatureAccess(organizationId, "operacion");
  const hasCrecimiento = await hasFeatureAccess(organizationId, "crecimiento");

  const allCourts = await listCourts(organizationId);
  const courts = allCourts.filter((c) => c.active);
  const todayBookings = await listBookingsForDate(organizationId, today);

  const confirmedCount = todayBookings.filter((b) =>
    ["confirmada", "en_curso", "finalizada"].includes(b.status)
  ).length;
  const pendingCount = todayBookings.filter((b) => b.status === "pendiente_pago").length;

  const courtOccupancy = await Promise.all(
    courts.map(async (court) => {
      const slots = await getSlotsForCourt(organizationId, court.id, today);
      const occupied = slots.filter((s) => !s.available).length;
      return { court, pct: slots.length ? occupied / slots.length : 0 };
    })
  );

  const overallOccupancy =
    courtOccupancy.reduce((sum, c) => sum + c.pct, 0) / (courtOccupancy.length || 1);

  const todayBookingsSorted = [...todayBookings].sort((a, b) => (a.startTime > b.startTime ? 1 : -1)).slice(0, 8);
  const todayAgenda = await Promise.all(
    todayBookingsSorted.map(async (booking) => ({
      booking,
      court: courts.find((c) => c.id === booking.courtId),
      customer: await getCustomer(organizationId, booking.customerId),
    }))
  );

  // El plan Starter (sin acceso a "operacion") solo ve un número acotado de
  // facturación: el total de la semana, solo canchas, nunca ventas de
  // productos ni el desglose día a día — esas vistas quedan reservadas
  // para Pro/Business, que sí tienen caja y punto de venta.
  let revenueTile: { label: string; value: string };
  let trend: Awaited<ReturnType<typeof computeDailyRevenue>> = [];
  let revenueByCourt: { court: (typeof courts)[number]; revenue: number }[] = [];
  let cashSession: Awaited<ReturnType<typeof getOpenCashSession>>;
  let lowStock: Awaited<ReturnType<typeof listLowStockProducts>> = [];

  if (hasOperacion) {
    const allSales = await listSales(organizationId);
    const todaySales = allSales.filter((s) => s.createdAt.startsWith(today));
    const courtRevenueToday = paymentsTotal(todayBookings);
    const productRevenueToday = todaySales.reduce((sum, s) => sum + s.total, 0);
    revenueTile = { label: "Facturación de hoy", value: formatCurrency(courtRevenueToday + productRevenueToday) };
    trend = await computeDailyRevenue(organizationId, 14);
    revenueByCourt = courts
      .map((court) => ({ court, revenue: paymentsTotal(todayBookings.filter((b) => b.courtId === court.id)) }))
      .sort((a, b) => b.revenue - a.revenue);
    cashSession = await getOpenCashSession(organizationId);
    lowStock = await listLowStockProducts(organizationId);
  } else {
    const weekly = await computeDailyRevenue(organizationId, 7);
    const weeklyCourtRevenue = weekly.reduce((sum, d) => sum + d.canchas, 0);
    revenueTile = { label: "Facturación de la semana (canchas)", value: formatCurrency(weeklyCourtRevenue) };
  }

  const activeTournamentsWithTeams: { tournament: Awaited<ReturnType<typeof listTournaments>>[number]; teamsCount: number }[] = [];
  if (hasCrecimiento) {
    const allTournaments = await listTournaments(organizationId);
    const activeTournaments = allTournaments.filter((t) => t.status !== "finalizado");
    for (const t of activeTournaments) {
      activeTournamentsWithTeams.push({ tournament: t, teamsCount: (await listTeamsForTournament(t.id)).length });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Buenos días 👋</h1>
      <p className="mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">{formatDateLong(today)}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={revenueTile.label} value={revenueTile.value} icon={TrendingUp} />
        <StatTile label="Reservas de hoy" value={String(todayBookings.length)} icon={ArrowUpRight} />
        <StatTile label="Confirmadas" value={String(confirmedCount)} sub={`${pendingCount} pendientes de pago`} />
        <StatTile label="Ocupación promedio" value={`${Math.round(overallOccupancy * 100)}%`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {hasOperacion && (
          <Card>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Facturación — últimos 14 días</h2>
            {trend.some((d) => d.total > 0) ? (
              <div className="mt-2">
                <RevenueTrendChart data={trend} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">Todavía no hay facturación para graficar.</p>
            )}
          </Card>
        )}

        <Card className={hasOperacion ? "" : "lg:col-span-2"}>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Ocupación por cancha</h2>
          <div className="mt-4 flex flex-col gap-3">
            {courtOccupancy.map(({ court, pct }) => (
              <OccupancyBar key={court.id} label={court.name} percentage={pct} />
            ))}
            {courtOccupancy.length === 0 && <p className="text-sm text-zinc-400">Todavía no cargaste canchas.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className={hasOperacion ? "" : "lg:col-span-2"}>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Agenda de hoy</h2>
            <Link href="/admin/agenda" className="text-sm text-emerald-600 dark:text-emerald-400">
              Ver todo
            </Link>
          </div>
          <div className="mt-4 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {todayAgenda.map(({ booking, court, customer }) => {
              return (
                <div key={booking.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="w-12 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">{booking.startTime}</span>
                  <span className="flex-1 truncate text-zinc-600 dark:text-zinc-400">
                    {court?.name} · {customer?.name}
                  </span>
                  <StatusBadge status={booking.status} />
                </div>
              );
            })}
            {todayBookings.length === 0 && (
              <p className="py-4 text-sm text-zinc-400">Sin reservas para hoy todavía.</p>
            )}
          </div>
        </Card>

        {hasOperacion && (
          <Card>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Ingresos de hoy por cancha</h2>
            <div className="mt-4 flex flex-col gap-2">
              {revenueByCourt.map(({ court, revenue }) => (
                <div key={court.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {court.name} <span className="text-zinc-400">· {SPORT_LABELS[court.sport]}</span>
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(revenue)}</span>
                </div>
              ))}
              {revenueByCourt.length === 0 && <p className="text-sm text-zinc-400">Todavía no cargaste canchas.</p>}
            </div>
            <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
              Caja: {cashSession ? "abierta" : "cerrada"} ·{" "}
              <Link href="/admin/caja" className="text-emerald-600 dark:text-emerald-400">
                {cashSession ? "ver movimientos" : "abrir caja"}
              </Link>
            </p>
          </Card>
        )}
      </div>

      {hasCrecimiento && activeTournamentsWithTeams.length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Torneos activos</h2>
            <Link href="/admin/torneos" className="text-sm text-emerald-600 dark:text-emerald-400">
              Ver todos
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {activeTournamentsWithTeams.map(({ tournament: t, teamsCount }) => {
              return (
                <Link
                  key={t.id}
                  href={`/admin/torneos/${t.id}`}
                  className="flex items-center justify-between text-sm text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  <span>{t.name}</span>
                  <span>
                    {teamsCount}/{t.maxTeams} inscriptos
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {(pendingCount > 0 || lowStock.length > 0) && (
        <div className="mt-4 flex flex-col gap-1.5">
          {pendingCount > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> {pendingCount} reserva{pendingCount > 1 ? "s" : ""} pendiente{pendingCount > 1 ? "s" : ""} de pago hoy.
            </p>
          )}
          {lowStock.length > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" /> {lowStock.length} producto{lowStock.length > 1 ? "s" : ""} con stock bajo:{" "}
              {lowStock.map((p) => p.name).join(", ")}.{" "}
              <Link href="/admin/inventario" className="underline">
                Ver inventario
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
