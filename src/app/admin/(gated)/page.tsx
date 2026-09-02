import Link from "next/link";
import {
  getCustomer,
  getOpenCashSession,
  getSlotsForCourt,
  listBookingsForDate,
  listCourts,
  listLowStockProducts,
  listSales,
  listTeamsForTournament,
  listTournaments,
} from "@/lib/db";
import { formatCurrency, SPORT_LABELS } from "@/lib/format";
import { formatDateLong, todayISO } from "@/lib/time";
import { Card, OccupancyBar, StatTile, StatusBadge } from "@/components/ui";

function paymentsTotal(bookings: ReturnType<typeof listBookingsForDate>) {
  return bookings.reduce((sum, b) => sum + b.payments.reduce((s, p) => s + p.amount, 0), 0);
}

export default function AdminDashboardPage() {
  const today = todayISO();
  const courts = listCourts().filter((c) => c.active);
  const todayBookings = listBookingsForDate(today);
  const todaySales = listSales().filter((s) => s.createdAt.startsWith(today));
  const lowStock = listLowStockProducts();
  const cashSession = getOpenCashSession();

  // Revenue actually collected today = payments recorded on today's bookings
  // (a "pendiente_pago" booking has none yet, "sena_pagada" only the deposit)
  // plus everything rung up at the POS today.
  const courtRevenueToday = paymentsTotal(todayBookings);
  const productRevenueToday = todaySales.reduce((sum, s) => sum + s.total, 0);
  const revenueToday = courtRevenueToday + productRevenueToday;

  const confirmedCount = todayBookings.filter((b) =>
    ["confirmada", "en_curso", "finalizada"].includes(b.status)
  ).length;
  const pendingCount = todayBookings.filter((b) => b.status === "pendiente_pago").length;

  const courtOccupancy = courts.map((court) => {
    const slots = getSlotsForCourt(court.id, today);
    const occupied = slots.filter((s) => !s.available).length;
    return { court, pct: slots.length ? occupied / slots.length : 0 };
  });

  const overallOccupancy =
    courtOccupancy.reduce((sum, c) => sum + c.pct, 0) / (courtOccupancy.length || 1);

  const revenueByCourt = courts
    .map((court) => ({
      court,
      revenue: paymentsTotal(todayBookings.filter((b) => b.courtId === court.id)),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const activeTournaments = listTournaments().filter((t) => t.status !== "finalizado");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Buenos días 👋</h1>
      <p className="mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">{formatDateLong(today)}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Facturación de hoy" value={formatCurrency(revenueToday)} />
        <StatTile label="Reservas de hoy" value={String(todayBookings.length)} />
        <StatTile label="Confirmadas" value={String(confirmedCount)} sub={`${pendingCount} pendientes de pago`} />
        <StatTile label="Ocupación promedio" value={`${Math.round(overallOccupancy * 100)}%`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Agenda de hoy</h2>
            <Link href="/admin/agenda" className="text-sm text-emerald-600 dark:text-emerald-400">
              Ver todo
            </Link>
          </div>
          <div className="mt-4 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {todayBookings
              .sort((a, b) => (a.startTime > b.startTime ? 1 : -1))
              .slice(0, 8)
              .map((booking) => {
                const court = courts.find((c) => c.id === booking.courtId);
                const customer = getCustomer(booking.customerId);
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

        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Ocupación por cancha</h2>
          <div className="mt-4 flex flex-col gap-3">
            {courtOccupancy.map(({ court, pct }) => (
              <OccupancyBar key={court.id} label={court.name} percentage={pct} />
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          </div>
        </Card>

        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Ingresos de hoy por categoría</h2>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Canchas</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(courtRevenueToday)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Bar / Productos</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(productRevenueToday)}</span>
            </div>
          </div>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
            Caja: {cashSession ? "abierta" : "cerrada"} ·{" "}
            <Link href="/admin/caja" className="text-emerald-600 dark:text-emerald-400">
              {cashSession ? "ver movimientos" : "abrir caja"}
            </Link>
          </p>
        </Card>
      </div>

      {activeTournaments.length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Torneos activos</h2>
            <Link href="/admin/torneos" className="text-sm text-emerald-600 dark:text-emerald-400">
              Ver todos
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {activeTournaments.map((t) => {
              const teams = listTeamsForTournament(t.id);
              return (
                <Link
                  key={t.id}
                  href={`/admin/torneos/${t.id}`}
                  className="flex items-center justify-between text-sm text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  <span>{t.name}</span>
                  <span>
                    {teams.length}/{t.maxTeams} inscriptos
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
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ {pendingCount} reserva{pendingCount > 1 ? "s" : ""} pendiente{pendingCount > 1 ? "s" : ""} de pago hoy.
            </p>
          )}
          {lowStock.length > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ {lowStock.length} producto{lowStock.length > 1 ? "s" : ""} con stock bajo:{" "}
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
