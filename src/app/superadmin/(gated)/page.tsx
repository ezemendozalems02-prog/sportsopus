import { getPlatformStats, listOrgSummaries } from "@/lib/db";
import { formatUsd } from "@/lib/format";
import Link from "next/link";

const PLAN_LABELS: Record<string, string> = { starter: "Starter", pro: "Pro", business: "Business" };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

export default async function SuperadminDashboardPage() {
  const stats = await getPlatformStats();
  const recentOrgs = (await listOrgSummaries()).slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-50">Dashboard de plataforma</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Organizaciones" value={String(stats.totalOrgs)} />
        <StatCard label="MRR (planes activos)" value={formatUsd(stats.mrrUSD)} />
        <StatCard label="En prueba gratis" value={String(stats.trialingCount)} />
        <StatCard label="Prueba vence en ≤3 días" value={String(stats.trialsEndingSoon)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-medium text-zinc-50">Estado de suscripciones</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Activas</span><span className="font-medium">{stats.activeCount}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">En prueba</span><span className="font-medium">{stats.trialingCount}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Pago vencido</span><span className="font-medium">{stats.pastDueCount}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Canceladas</span><span className="font-medium">{stats.canceledCount}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-medium text-zinc-50">Distribución de planes</h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {stats.planDistribution.map((p) => (
              <div key={p.planId} className="flex justify-between">
                <span className="text-zinc-400">{PLAN_LABELS[p.planId]}</span>
                <span className="font-medium">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-zinc-50">Últimas organizaciones</h2>
          <Link href="/superadmin/organizaciones" className="text-sm text-emerald-400">
            Ver todas
          </Link>
        </div>
        <div className="mt-3 flex flex-col divide-y divide-zinc-800">
          {recentOrgs.map((row) => (
            <Link
              key={row.organization.id}
              href={`/superadmin/organizaciones/${row.organization.id}`}
              className="flex items-center justify-between py-2.5 text-sm hover:text-emerald-400"
            >
              <span>{row.organization.name}</span>
              <span className="text-zinc-400">{PLAN_LABELS[row.organization.plan]} · {row.organization.subscriptionStatus}</span>
            </Link>
          ))}
          {recentOrgs.length === 0 && <p className="py-2.5 text-sm text-zinc-500">Todavía no hay organizaciones registradas.</p>}
        </div>
      </div>
    </div>
  );
}
