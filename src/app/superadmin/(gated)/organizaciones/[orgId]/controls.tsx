"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { superadminChangePlanAction, superadminSetStatusAction } from "@/lib/actions";
import type { Plan, PlanId, SubscriptionStatus } from "@/lib/types";

const STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due", "canceled"];

export function OrgControls({ organizationId, plans, currentPlan, currentStatus }: {
  organizationId: string;
  plans: Plan[];
  currentPlan: PlanId;
  currentStatus: SubscriptionStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
    </div>
  );
}
