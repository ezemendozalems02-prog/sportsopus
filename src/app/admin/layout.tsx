import Link from "next/link";
import { computeAccessState, getOrganization, getPlan, hasFeatureAccess, listEmployees } from "@/lib/db";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/format";
import type { PlanFeatureGroup } from "@/lib/types";

const NAV_CORE = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/canchas", label: "Canchas" },
  { href: "/admin/clientes", label: "Clientes" },
];

const NAV_OPERACION = [
  { href: "/admin/caja", label: "Caja" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/gastos", label: "Gastos" },
  { href: "/admin/empleados", label: "Empleados" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

const NAV_CRECIMIENTO = [
  { href: "/admin/torneos", label: "Torneos" },
  { href: "/admin/ranking", label: "Ranking" },
  { href: "/admin/promociones", label: "Promociones" },
  { href: "/admin/notificaciones", label: "Notificaciones" },
];

const NAV_INTELIGENCIA = [
  { href: "/admin/analitica", label: "Analítica" },
  { href: "/admin/alertas", label: "Alertas" },
  { href: "/admin/reportes", label: "Reportes" },
];

const NAV = [...NAV_CORE, ...NAV_OPERACION, ...NAV_CRECIMIENTO, ...NAV_INTELIGENCIA];

const COMING_SOON = ["Configuración"];

function NavSection({
  title,
  items,
  locked,
}: {
  title?: string;
  items: { href: string; label: string }[];
  locked?: boolean;
}) {
  return (
    <>
      {title && (
        <p className="mt-4 flex items-center gap-1.5 px-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
          {title}
          {locked && <span title="Requiere mejorar tu plan">🔒</span>}
        </p>
      )}
      <nav className={`flex flex-col gap-1 ${title ? "mt-1" : "mt-6"}`}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              locked ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const organization = getOrganization();
  const owner = listEmployees().find((e) => e.role === "owner");
  const access = computeAccessState();
  const currentPlan = getPlan(organization.plan);
  const statusMeta = SUBSCRIPTION_STATUS_LABELS[organization.subscriptionStatus];

  const locked: Record<PlanFeatureGroup, boolean> = {
    operacion: !hasFeatureAccess("operacion"),
    crecimiento: !hasFeatureAccess("crecimiento"),
    inteligencia: !hasFeatureAccess("inteligencia"),
  };

  return (
    <div className="flex flex-1 bg-zinc-50 dark:bg-black">
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        <Link href="/" className="px-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          SportControl
        </Link>
        <p className="mt-1 px-2 text-xs text-zinc-500 dark:text-zinc-400">{organization.name}</p>
        <Link
          href="/admin/plan"
          className="mt-2 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800"
        >
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Plan {currentPlan?.name}</span>
          <span className="text-zinc-400">{statusMeta.label}</span>
        </Link>

        <NavSection items={NAV_CORE} />
        <NavSection title="Operación" items={NAV_OPERACION} locked={locked.operacion} />
        <NavSection title="Crecimiento" items={NAV_CRECIMIENTO} locked={locked.crecimiento} />
        <NavSection title="Inteligencia" items={NAV_INTELIGENCIA} locked={locked.inteligencia} />

        <p className="mt-4 px-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Próximamente</p>
        <nav className="mt-1 flex flex-col gap-1">
          {COMING_SOON.map((label) => (
            <span key={label} className="rounded-lg px-3 py-2 text-sm text-zinc-400">
              {label}
            </span>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-medium text-white">
            {owner?.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{owner?.name}</p>
            <p className="truncate text-xs capitalize text-zinc-400">{owner?.role}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
            SportControl
          </Link>
          <nav className="flex gap-3 overflow-x-auto whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="shrink-0">
                {item.label}
              </Link>
            ))}
            <Link href="/admin/plan" className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">
              Plan
            </Link>
          </nav>
        </header>

        {!access.blocked && organization.subscriptionStatus === "trialing" && (
          <div className="flex items-center justify-between gap-3 bg-emerald-600 px-4 py-2 text-sm text-white sm:px-6 lg:px-8">
            <span>🎁 Prueba gratis: te quedan {access.trialDaysLeft ?? 0} días.</span>
            <Link href="/admin/plan" className="shrink-0 font-medium underline">
              Elegir plan
            </Link>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
