import Link from "next/link";
import {
  computeLowDemandRecommendations,
  listBookingsForDate,
  listCashMovements,
  listCashSessions,
  listLowStockProducts,
} from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { formatCurrency } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { Card } from "@/components/ui";

function alertCard(key: string, emoji: string, text: React.ReactNode, href?: string, cta?: string) {
  return (
    <div
      key={key}
      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <span>
        {emoji} {text}
      </span>
      {href && cta && (
        <Link href={href} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">
          {cta}
        </Link>
      )}
    </div>
  );
}

export default async function AlertasPage() {
  const { organizationId } = await requireEmployeeSession();
  const today = todayISO();
  const todayBookings = await listBookingsForDate(organizationId, today);
  const pending = todayBookings.filter((b) => b.status === "pendiente_pago");
  const lowStock = await listLowStockProducts(organizationId);
  const lowDemand = await computeLowDemandRecommendations(organizationId, 3);

  const cashSessions = await listCashSessions(organizationId);
  const closedCashSessions = cashSessions.filter((s) => s.status === "cerrada" && s.closingCountedAmount !== undefined);
  const cashDiscrepancies = (
    await Promise.all(
      closedCashSessions.map(async (session) => {
        const movements = await listCashMovements(organizationId, session.id);
        const expected = session.openingAmount + movements.filter((m) => m.method === "efectivo").reduce((sum, m) => sum + m.amount, 0);
        const diff = (session.closingCountedAmount ?? 0) - expected;
        return { session, diff };
      })
    )
  )
    .filter((d) => Math.abs(d.diff) >= 1000)
    .slice(0, 5);

  const alerts: { key: string; node: React.ReactNode }[] = [];

  if (pending.length > 0) {
    alerts.push({
      key: "pending",
      node: alertCard(
        "pending",
        "⏳",
        <>
          {pending.length} reserva{pending.length > 1 ? "s" : ""} de hoy sin seña pagada todavía.
        </>,
        "/admin/agenda",
        "Ver agenda"
      ),
    });
  }

  if (lowStock.length > 0) {
    alerts.push({
      key: "stock",
      node: alertCard(
        "stock",
        "📦",
        <>
          {lowStock.length} producto{lowStock.length > 1 ? "s" : ""} con stock bajo: {lowStock.map((p) => p.name).join(", ")}.
        </>,
        "/admin/inventario",
        "Reponer"
      ),
    });
  }

  for (const { session, diff } of cashDiscrepancies) {
    alerts.push({
      key: `cash_${session.id}`,
      node: alertCard(
        `cash_${session.id}`,
        "💸",
        <>
          Diferencia de caja el {session.closedAt?.slice(0, 10)}: {diff > 0 ? "sobraron" : "faltaron"} {formatCurrency(Math.abs(diff))}.
        </>
      ),
    });
  }

  for (const rec of lowDemand) {
    alerts.push({
      key: `demand_${rec.court.id}_${rec.dow}_${rec.hourBandLabel}`,
      node: alertCard(
        `demand_${rec.court.id}`,
        "🪫",
        <>
          {rec.court.name} tiene baja ocupación los {rec.dayLabel.toLowerCase()} de {rec.hourBandLabel}hs ({Math.round(rec.occupancyPct * 100)}%).
        </>,
        `/admin/promociones?dow=${rec.dow}&band=${rec.hourBandLabel}&sport=${rec.court.sport}`,
        "Crear promo"
      ),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Alertas</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Todo lo que conviene revisar hoy, en un solo lugar.</p>

      <div className="mt-6 flex flex-col gap-2">
        {alerts.map((a) => (
          <div key={a.key}>{a.node}</div>
        ))}
        {alerts.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">Sin alertas por ahora. Todo tranquilo ✓</p>
          </Card>
        )}
      </div>
    </div>
  );
}
