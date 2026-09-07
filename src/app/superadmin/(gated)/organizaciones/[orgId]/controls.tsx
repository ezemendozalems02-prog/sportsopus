"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { superadminChangePlanAction, superadminGrantTrialAction, superadminSetStatusAction } from "@/lib/actions";
import type { Plan, PlanId, SubscriptionStatus } from "@/lib/types";

// "trialing" no está acá: se otorga con el control de "prueba gratis" de
// abajo (que carga los días), nunca eligiéndolo suelto en este select.
const STATUSES: SubscriptionStatus[] = ["active", "past_due", "canceled"];

export function OrgControls({ organizationId, plans, currentPlan, currentStatus }: {
  organizationId: string;
  plans: Plan[];
  currentPlan: PlanId;
  currentStatus: SubscriptionStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [trialDays, setTrialDays] = useState(7);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="text-sm text-zinc-400">
        Plan{" "}
        <select
          defaultValue={currentPlan}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () => {
              await superadminChangePlanAction(organizationId, e.target.value as PlanId);
              router.refresh();
            })
          }
          className="ml-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-50"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-zinc-400">
        Estado{" "}
        <select
          defaultValue={currentStatus}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () => {
              await superadminSetStatusAction(organizationId, e.target.value as SubscriptionStatus);
              router.refresh();
            })
          }
          className="ml-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-50"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm text-zinc-400">
        Prueba gratis
        <input
          type="number"
          min={1}
          value={trialDays}
          onChange={(e) => setTrialDays(Number(e.target.value))}
          disabled={pending}
          className="ml-1 w-16 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-50"
        />
        días
      </label>
      <button
        disabled={pending || trialDays <= 0}
        onClick={() =>
          startTransition(async () => {
            await superadminGrantTrialAction(organizationId, trialDays);
            router.refresh();
          })
        }
        className="rounded-lg border border-emerald-700 px-3 py-1 text-sm font-medium text-emerald-400 hover:bg-emerald-950/40 disabled:opacity-60"
      >
        Dar prueba gratis
      </button>
    </div>
  );
}
