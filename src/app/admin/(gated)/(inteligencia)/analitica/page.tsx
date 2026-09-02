import Link from "next/link";
import {
  computeCourtRevenueRanking,
  computeDailyRevenue,
  computeHighDemandBand,
  computeHourBandStats,
  computeLowDemandRecommendations,
  computePaymentMethodTotals,
  computeProfitAndLoss,
  computeRevenueByCategory,
  computeWeekdayStats,
} from "@/lib/db";
import { formatCurrency, PAYMENT_METHOD_LABELS, SPORT_LABELS } from "@/lib/format";
import { formatDateShort } from "@/lib/time";
import { BarChart, Card, OccupancyBar, StatTile } from "@/components/ui";

export default function AnaliticaPage() {
  const daily = computeDailyRevenue(14);
  const courtRanking = computeCourtRevenueRanking();
  const hourBands = computeHourBandStats();
  const weekdays = computeWeekdayStats();
  const paymentMethods = computePaymentMethodTotals();
  const category = computeRevenueByCategory();
  const pnl = computeProfitAndLoss();
  const lowDemand = computeLowDemandRecommendations(3);
  const highDemand = computeHighDemandBand();

  const topCourt = courtRanking[0];
  const bestWeekday = [...weekdays].sort((a, b) => b.occupancyPct - a.occupancyPct)[0];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Analítica</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Basado en los últimos 35 días de reservas y 21 de caja.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Ingresos totales" value={formatCurrency(pnl.ingresos)} />
        <StatTile label="Gastos totales" value={formatCurrency(pnl.gastos)} />
        <StatTile label="Resultado" value={formatCurrency(pnl.resultado)} sub={`${Math.round(pnl.margin * 100)}% margen`} />
        <StatTile label="Cancha top" value={topCourt?.court.name ?? "—"} sub={topCourt ? formatCurrency(topCourt.revenue) : undefined} />
      </div>

      <Card className="mt-6">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Facturación últimos 14 días</h2>
        <div className="mt-4">
          <BarChart
            data={daily.map((d) => ({ label: d.date, value: d.total }))}
            formatValue={formatCurrency}
            formatLabel={formatDateShort}
          />
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Rentabilidad por cancha</h2>
          <p className="mt-1 text-xs text-zinc-400">Últimos 35 días · % vs. la cancha que más factura</p>
          <div className="mt-4 flex flex-col gap-2">
            {courtRanking.map((row) => {
              const diff = topCourt && topCourt.revenue > 0 ? (row.revenue / topCourt.revenue - 1) * 100 : 0;
              return (
                <div key={row.court.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {row.court.name} <span className="text-zinc-400">· {SPORT_LABELS[row.court.sport]}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(row.revenue)}</span>
                    {row.court.id !== topCourt?.court.id && (
                      <span className="text-xs text-red-500">{Math.round(diff)}%</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Horarios más rentables</h2>
          <div className="mt-4 flex flex-col gap-3">
            {hourBands.map((band) => (
              <div key={band.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{band.label}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(band.revenue)}</span>
                </div>
                <div className="mt-1">
                  <OccupancyBar label="" percentage={band.occupancyPct} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Ingresos por categoría</h2>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Cancha</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {formatCurrency(category.canchas)} · {category.total ? Math.round((category.canchas / category.total) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Bar / Productos</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {formatCurrency(category.productos)} · {category.total ? Math.round((category.productos / category.total) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Torneos</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {formatCurrency(category.torneos)} · {category.total ? Math.round((category.torneos / category.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Métodos de pago</h2>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {paymentMethods.map((m) => (
              <div key={m.method} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">{PAYMENT_METHOD_LABELS[m.method]}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(m.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Recomendaciones</h2>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {highDemand && (
            <p className="text-zinc-600 dark:text-zinc-400">
              📈 Mayor demanda: <strong className="text-zinc-900 dark:text-zinc-50">{highDemand.dayLabel} {highDemand.hourBandLabel}hs</strong> ({Math.round(highDemand.occupancyPct * 100)}% de ocupación). No es un buen horario para bajar precios.
            </p>
          )}
          {bestWeekday && (
            <p className="text-zinc-600 dark:text-zinc-400">
              📅 El día con mejor ocupación promedio es <strong className="text-zinc-900 dark:text-zinc-50">{bestWeekday.label}</strong> ({Math.round(bestWeekday.occupancyPct * 100)}%).
            </p>
          )}
          {lowDemand.map((rec) => (
            <div key={`${rec.court.id}_${rec.dow}_${rec.hourBandLabel}`} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/40">
              <span className="text-amber-800 dark:text-amber-300">
                🪫 {rec.court.name} los {rec.dayLabel.toLowerCase()} de {rec.hourBandLabel}hs tiene baja ocupación ({Math.round(rec.occupancyPct * 100)}%).
              </span>
              <Link
                href={`/admin/promociones?dow=${rec.dow}&band=${rec.hourBandLabel}&sport=${rec.court.sport}`}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                Crear promo
              </Link>
            </div>
          ))}
          {lowDemand.length === 0 && (
            <p className="text-zinc-400">Todavía no hay suficiente historial para detectar horarios de baja demanda.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
