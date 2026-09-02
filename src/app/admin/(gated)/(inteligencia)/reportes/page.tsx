import Link from "next/link";
import {
  getCourt,
  getCustomer,
  getSlotsForCourt,
  listBookingsForDate,
  listCourts,
  listExpenses,
  listSales,
  listTeamsForTournament,
  listTournaments,
} from "@/lib/db";
import { EXPENSE_CATEGORY_LABELS, formatCurrency } from "@/lib/format";
import { addDaysISO, formatDateLong, todayISO } from "@/lib/time";
import { Card, StatTile } from "@/components/ui";

const PERIODS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
];

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const days = period === "30" ? 30 : 7;
  const today = todayISO();
  const fromDate = addDaysISO(today, -(days - 1));
  const inRange = (dateISO: string) => dateISO >= fromDate && dateISO <= today;

  const courts = listCourts().filter((c) => c.active);
  const allSales = listSales().filter((s) => inRange(s.createdAt.slice(0, 10)));
  const allExpenses = listExpenses().filter((e) => inRange(e.date));

  // Revenue collected per booking payment, occupancy and per-court revenue —
  // all derived by walking each day in the period once.
  let canchasRevenue = 0;
  let occupiedSum = 0;
  let possibleSum = 0;
  const revenueByCustomer = new Map<string, number>();
  const revenueByCourt = new Map<string, number>();

  for (let offset = -(days - 1); offset <= 0; offset++) {
    const date = addDaysISO(today, offset);
    for (const court of courts) {
      const slots = getSlotsForCourt(court.id, date);
      possibleSum += slots.length;
      occupiedSum += slots.filter((s) => !s.available).length;
    }
    for (const booking of listBookingsForDate(date)) {
      const paidThisBooking = booking.payments.reduce((sum, p) => (inRange(p.paidAt.slice(0, 10)) ? sum + p.amount : sum), 0);
      if (paidThisBooking === 0) continue;
      canchasRevenue += paidThisBooking;
      revenueByCustomer.set(booking.customerId, (revenueByCustomer.get(booking.customerId) ?? 0) + paidThisBooking);
      revenueByCourt.set(booking.courtId, (revenueByCourt.get(booking.courtId) ?? 0) + paidThisBooking);
    }
  }
  const avgOccupancy = possibleSum ? occupiedSum / possibleSum : 0;

  const productosRevenue = allSales.reduce((sum, s) => sum + s.total, 0);
  const torneosRevenue = listTournaments().reduce((sum, t) => {
    const teams = listTeamsForTournament(t.id).filter((team) => team.paidEntry && inRange(team.registeredAt.slice(0, 10)));
    return sum + teams.length * t.entryFee;
  }, 0);
  const ingresos = canchasRevenue + productosRevenue + torneosRevenue;
  const gastos = allExpenses.reduce((sum, e) => sum + e.amount, 0);
  const resultado = ingresos - gastos;

  const topCourts = [...revenueByCourt.entries()]
    .map(([courtId, revenue]) => ({ court: getCourt(courtId), revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const topCustomers = [...revenueByCustomer.entries()]
    .map(([customerId, spent]) => ({ customer: getCustomer(customerId), spent }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  const productQuantities = new Map<string, number>();
  for (const sale of allSales) {
    for (const item of sale.items) {
      productQuantities.set(item.name, (productQuantities.get(item.name) ?? 0) + item.quantity);
    }
  }
  const topProducts = [...productQuantities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const expensesByCategory = new Map<string, number>();
  for (const e of allExpenses) expensesByCategory.set(e.category, (expensesByCategory.get(e.category) ?? 0) + e.amount);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Reportes</h1>
          <p className="mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">
            {formatDateLong(fromDate)} — {formatDateLong(today)}
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/reportes?period=${p.value}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                days === Number(p.value)
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Ingresos" value={formatCurrency(ingresos)} />
        <StatTile label="Gastos" value={formatCurrency(gastos)} />
        <StatTile label="Resultado" value={formatCurrency(resultado)} sub={`${ingresos ? Math.round((resultado / ingresos) * 100) : 0}% margen`} />
        <StatTile label="Ocupación promedio" value={`${Math.round(avgOccupancy * 100)}%`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Top canchas</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            {topCourts.map(({ court, revenue }) => (
              <div key={court?.id} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">{court?.name}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(revenue)}</span>
              </div>
            ))}
            {topCourts.length === 0 && <p className="text-zinc-400">Sin datos en este período.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Top clientes</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            {topCustomers.map(({ customer, spent }) => (
              <div key={customer?.id} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">{customer?.name}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(spent)}</span>
              </div>
            ))}
            {topCustomers.length === 0 && <p className="text-zinc-400">Sin datos en este período.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Productos más vendidos</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            {topProducts.map(([name, qty]) => (
              <div key={name} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">{name}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{qty} un.</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-zinc-400">Sin ventas en este período.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Gastos por categoría</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            {[...expensesByCategory.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => (
              <div key={category} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">{EXPENSE_CATEGORY_LABELS[category]}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(amount)}</span>
              </div>
            ))}
            {expensesByCategory.size === 0 && <p className="text-zinc-400">Sin gastos en este período.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
