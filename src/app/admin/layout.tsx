import Link from "next/link";
import { Gift, LogOut } from "lucide-react";
import { computeAccessState, getEmployeeById, getOrganizationById, getPlan, hasFeatureAccess } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/format";
import { roleCanAccess } from "@/lib/permissions";
import type { PlanFeatureGroup } from "@/lib/types";
import { NavSection } from "./nav-section";

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { employeeId, organizationId } = await requireEmployeeSession();
  const organization = await getOrganizationById(organizationId);
  const employee = await getEmployeeById(organizationId, employeeId);
  if (!organization || !employee) return null;

  const access = await computeAccessState(organizationId);
  const currentPlan = getPlan(organization.plan);
  const statusMeta = SUBSCRIPTION_STATUS_LABELS[organization.subscriptionStatus];
  const isOwner = employee.role === "owner";

  const [operacionAccess, crecimientoAccess, inteligenciaAccess] = await Promise.all([
    hasFeatureAccess(organizationId, "operacion"),
    hasFeatureAccess(organizationId, "crecimiento"),
    hasFeatureAccess(organizationId, "inteligencia"),
  ]);
  const locked: Record<PlanFeatureGroup, boolean> = {
    operacion: !operacionAccess,
    crecimiento: !crecimientoAccess,
    inteligencia: !inteligenciaAccess,
  };

  // Cada rol solo ve los links a los que realmente puede entrar — el resto
  // ni aparece (distinto de "bloqueado por plan", que sí se muestra con
  // candado porque el dueño puede resolverlo mejorando el plan).
  const forRole = (items: { href: string; label: string }[]) =>
    items.filter((item) => roleCanAccess(employee.role, item.href));
  const navCore = forRole(NAV_CORE);
  const navOperacion = forRole(NAV_OPERACION);
  const navCrecimiento = forRole(NAV_CRECIMIENTO);
  const navInteligencia = forRole(NAV_INTELIGENCIA);
  const navAll = forRole(NAV);

  return (
    <div className="flex flex-1 bg-zinc-50 dark:bg-black">
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        <Link href="/" className="px-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          SportControl
        </Link>
        <p className="mt-1 truncate px-2 text-xs text-zinc-500 dark:text-zinc-400">{organization.name}</p>
        {isOwner && (
          <Link
            href="/admin/plan"
            className="mt-2 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-xs transition hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Plan {currentPlan?.name}</span>
            <span className="text-zinc-400">{statusMeta.label}</span>
          </Link>
        )}

        {navCore.length > 0 && <NavSection items={navCore} />}
        {navOperacion.length > 0 && <NavSection title="Operación" items={navOperacion} locked={locked.operacion} />}
        {navCrecimiento.length > 0 && <NavSection title="Crecimiento" items={navCrecimiento} locked={locked.crecimiento} />}
        {navInteligencia.length > 0 && <NavSection title="Inteligencia" items={navInteligencia} locked={locked.inteligencia} />}

        <div className="mt-auto flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-medium text-white">
            {employee.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{employee.name}</p>
            <p className="truncate text-xs capitalize text-zinc-400">{employee.role}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
            SportControl
          </Link>
          <nav className="flex gap-3 overflow-x-auto whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
            {navAll.map((item) => (
              <Link key={item.href} href={item.href} className="shrink-0">
                {item.label}
              </Link>
            ))}
            {isOwner && (
              <Link href="/admin/plan" className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">
                Plan
              </Link>
            )}
          </nav>
        </header>

        {isOwner && !access.blocked && organization.subscriptionStatus === "trialing" && (
          <div className="flex items-center justify-between gap-3 bg-emerald-600 px-4 py-2 text-sm text-white sm:px-6 lg:px-8">
            <span className="flex items-center gap-1.5">
              <Gift className="h-4 w-4" /> Prueba gratis: te quedan {access.trialDaysLeft ?? 0} días.
            </span>
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
