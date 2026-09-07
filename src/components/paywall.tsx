import Link from "next/link";
import { listPlans } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import type { PlanFeatureGroup } from "@/lib/types";

const REASON_COPY: Record<string, { title: string; body: string }> = {
  trial_expired: {
    title: "Tu prueba gratis terminó",
    body: "Elegí un plan para seguir usando SportControl — tus datos siguen todos ahí.",
  },
  canceled: {
    title: "Activá tu plan para entrar",
    body: "Elegí un plan y pagalo con Mercado Pago para acceder al panel del negocio.",
  },
  past_due: {
    title: "Hay un problema con tu pago",
    body: "No pudimos procesar el último cobro de tu suscripción. Actualizá el medio de pago para seguir usando SportControl.",
  },
};

export function SubscriptionPaywall({ reason }: { reason: "trial_expired" | "canceled" | "past_due" }) {
  const copy = REASON_COPY[reason];
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-3xl">🔒</p>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{copy.title}</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{copy.body}</p>
      <Link
        href="/admin/plan"
        className="mt-6 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Ver planes
      </Link>
    </div>
  );
}

const GROUP_LABELS: Record<PlanFeatureGroup, string> = {
  operacion: "Operación",
  crecimiento: "Crecimiento",
  inteligencia: "Inteligencia",
};

export function PlanUpsell({ group }: { group: PlanFeatureGroup }) {
  const unlockingPlan = listPlans().find((p) => p.featureGroups.includes(group));
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-3xl">✨</p>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {GROUP_LABELS[group]} es parte del plan {unlockingPlan?.name ?? ""}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Mejorá tu plan para desbloquear esta sección{unlockingPlan ? ` desde ${unlockingPlan.name} (${formatCurrency(unlockingPlan.priceARS)}/mes)` : ""}.
      </p>
      <Link
        href="/admin/plan"
        className="mt-6 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Ver planes
      </Link>
    </div>
  );
}
