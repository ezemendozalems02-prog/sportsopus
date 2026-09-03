import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getOrganizationById,
  listBillingInvoices,
  listBookings,
  listCourts,
  listEmployees,
  listPlans,
} from "@/lib/db";
import { SUBSCRIPTION_STATUS_LABELS, formatUsd } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { OrgControls } from "./controls";

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const [employees, courts, bookings, invoices] = await Promise.all([
    listEmployees(orgId),
    listCourts(orgId),
    listBookings(orgId),
    listBillingInvoices(orgId),
  ]);
  const plans = listPlans();
  const statusMeta = SUBSCRIPTION_STATUS_LABELS[organization.subscriptionStatus];

  return (
    <div>
      <Link href="/superadmin/organizaciones" className="text-sm text-zinc-400">
        ← Organizaciones
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{organization.name}</h1>
          <p className="text-sm text-zinc-500">/{organization.slug} · {statusMeta.label}</p>
        </div>
      </div>

      <OrgControls
        organizationId={organization.id}
        plans={plans}
        currentPlan={organization.plan}
        currentStatus={organization.subscriptionStatus}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Empleados</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">{employees.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Canchas</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">{courts.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Reservas totales</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-50">{bookings.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Trial vence</p>
          <p className="mt-1 text-lg font-semibold text-zinc-50">
            {organization.trialEndsAt ? formatDateLong(organization.trialEndsAt) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-medium text-zinc-50">Empleados</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            {employees.map((e) => (
              <div key={e.id} className="flex justify-between">
                <span className="text-zinc-300">{e.name}</span>
                <span className="text-zinc-500">{e.email} · {e.role}</span>
              </div>
            ))}
            {employees.length === 0 && <p className="text-zinc-500">Sin empleados.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-medium text-zinc-50">Facturación</h2>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex justify-between">
                <span className="text-zinc-300">{formatDateLong(inv.periodStart)}</span>
                <span className="text-zinc-500">{formatUsd(inv.amountUSD)} · {inv.status}</span>
              </div>
            ))}
            {invoices.length === 0 && <p className="text-zinc-500">Sin facturas todavía.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
