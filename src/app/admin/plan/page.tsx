import { computeAccessState, getOrganizationById, getPlan, listBillingInvoices, listPlans, priceInArs } from "@/lib/db";
import { requireEmployeeSession } from "@/lib/session";
import { formatCurrency, formatUsd, SUBSCRIPTION_STATUS_LABELS } from "@/lib/format";
import { formatDateLong } from "@/lib/time";
import { Card } from "@/components/ui";
import { ChangePlanButton } from "./change-plan-button";
import { ActivateSubscriptionForm } from "./activate-subscription-form";
import { CancelSubscriptionButton, SimulateTrialExpiredButton } from "./subscription-controls";

const STATUS_COLORS: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default async function PlanPage() {
  const { organizationId } = await requireEmployeeSession();
  const org = await getOrganizationById(organizationId);
  if (!org) return null;
  const plans = listPlans();
  const currentPlan = getPlan(org.plan);
  const access = await computeAccessState(organizationId);
  const invoices = await listBillingInvoices(organizationId);
  const statusMeta = SUBSCRIPTION_STATUS_LABELS[org.subscriptionStatus];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Plan y facturación</h1>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              Plan {currentPlan?.name} — {formatUsd(currentPlan?.priceUSD ?? 0)}/mes
            </p>
            <p className="text-xs text-zinc-400">≈ {formatCurrency(priceInArs(currentPlan?.priceUSD ?? 0))}/mes vía Mercado Pago</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[statusMeta.color]}`}>
            {statusMeta.label}
          </span>
        </div>

        {org.subscriptionStatus === "trialing" && !access.blocked && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Te quedan <strong className="text-zinc-900 dark:text-zinc-50">{access.trialDaysLeft ?? 0} días</strong> de prueba gratis.
            {" "}
            <SimulateTrialExpiredButton />
          </p>
        )}
        {org.subscriptionStatus === "active" && org.currentPeriodEnd && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Próximo cobro: <span className="capitalize">{formatDateLong(org.currentPeriodEnd)}</span>.{" "}
            <CancelSubscriptionButton />
          </p>
        )}
        {(org.subscriptionStatus === "canceled" || org.subscriptionStatus === "past_due") && currentPlan && (
          <div className="mt-4">
            <ActivateSubscriptionForm plan={currentPlan} defaultEmail={org.billingEmail ?? ""} />
          </div>
        )}
      </Card>

      {org.subscriptionStatus === "trialing" && currentPlan && (
        <div className="mt-6">
          <ActivateSubscriptionForm plan={currentPlan} defaultEmail={org.billingEmail ?? ""} />
        </div>
      )}

      <h2 className="mt-8 text-lg font-medium text-zinc-900 dark:text-zinc-50">Planes disponibles</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.id === org.plan ? "border-emerald-400" : ""}>
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{plan.name}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {formatUsd(plan.priceUSD)}
              <span className="text-sm font-normal text-zinc-400">/mes</span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">{plan.tagline}</p>
            <ul className="mt-4 flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="text-emerald-500">✓</span>
                  {h}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <ChangePlanButton planId={plan.id} current={plan.id === org.plan} />
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-medium text-zinc-900 dark:text-zinc-50">Historial de facturación</h2>
      <div className="mt-4 flex flex-col gap-2">
        {invoices.map((invoice) => (
          <Card key={invoice.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {formatDateLong(invoice.periodStart)} — {formatDateLong(invoice.periodEnd)}
              </p>
              <p className="text-xs text-zinc-400">Plan {invoice.plan}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{formatUsd(invoice.amountUSD)}</p>
              <p className="text-xs capitalize text-zinc-400">{invoice.status}</p>
            </div>
          </Card>
        ))}
        {invoices.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-400">Todavía no hay pagos registrados.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
