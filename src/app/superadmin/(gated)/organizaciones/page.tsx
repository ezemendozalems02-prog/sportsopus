import Link from "next/link";
import { listOrgSummaries } from "@/lib/db";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/format";
import { formatDateLong } from "@/lib/time";

const PLAN_LABELS: Record<string, string> = { starter: "Starter", pro: "Pro", business: "Business" };

export default async function OrganizacionesPage() {
  const rows = await listOrgSummaries();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-50">Organizaciones</h1>
      <p className="mt-1 text-sm text-zinc-400">{rows.length} cuentas registradas</p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3">Organización</th>
              <th className="px-3">Plan</th>
              <th className="px-3">Estado</th>
              <th className="px-3">Dueño</th>
              <th className="px-3">Empleados</th>
              <th className="px-3">Canchas</th>
              <th className="px-3">Clientes</th>
              <th className="px-3">Reservas</th>
              <th className="px-3">Trial vence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ organization, ownerEmail, employeeCount, courtCount, bookingCount, customerCount, activeCustomerCount }) => {
              const statusMeta = SUBSCRIPTION_STATUS_LABELS[organization.subscriptionStatus];
              return (
                <tr key={organization.id}>
                  <td className="rounded-l-xl bg-zinc-900 px-3 py-3">
                    <Link href={`/superadmin/organizaciones/${organization.id}`} className="font-medium text-zinc-50 hover:text-emerald-400">
                      {organization.name}
                    </Link>
                    <p className="text-xs text-zinc-500">/{organization.slug}</p>
                  </td>
                  <td className="bg-zinc-900 px-3 py-3 text-zinc-300">{PLAN_LABELS[organization.plan]}</td>
                  <td className="bg-zinc-900 px-3 py-3 text-zinc-300">{statusMeta.label}</td>
                  <td className="bg-zinc-900 px-3 py-3 text-zinc-400">{ownerEmail}</td>
                  <td className="bg-zinc-900 px-3 py-3 text-zinc-300">{employeeCount}</td>
                  <td className="bg-zinc-900 px-3 py-3 text-zinc-300">{courtCount}</td>
                  <td className="bg-zinc-900 px-3 py-3 text-zinc-300">{customerCount} <span className="text-zinc-500">({activeCustomerCount} activos)</span></td>
                  <td className="bg-zinc-900 px-3 py-3 text-zinc-300">{bookingCount}</td>
                  <td className="rounded-r-xl bg-zinc-900 px-3 py-3 text-zinc-400">
                    {organization.trialEndsAt ? formatDateLong(organization.trialEndsAt) : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="rounded-xl bg-zinc-900 px-3 py-6 text-center text-zinc-500">
                  Todavía no se registró ninguna organización.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
