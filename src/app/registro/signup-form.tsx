"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startTrialAction } from "@/lib/actions";
import { formatUsd } from "@/lib/format";
import type { Plan, PlanId } from "@/lib/types";

export function SignupForm({ plans, initialPlan, orgName }: { plans: Plan[]; initialPlan: PlanId; orgName: string }) {
  const router = useRouter();
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const plan = plans.find((p) => p.id === planId)!;

  function handleSubmit() {
    if (!name || !email) return;
    startTransition(async () => {
      await startTrialAction(planId, email);
      router.push("/admin");
    });
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-400">
        Esta demo tiene un solo complejo ({orgName}) — al confirmar, activamos la prueba gratis sobre esa cuenta de
        ejemplo.
      </p>

      <label className="mt-4 block text-sm text-zinc-600 dark:text-zinc-400">
        Tu nombre
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Martín Suárez"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="martin@tucomplejo.com"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Plan
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value as PlanId)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatUsd(p.priceUSD)}/mes
            </option>
          ))}
        </select>
      </label>

      <p className="mt-3 text-xs text-zinc-400">{plan.tagline}. 7 días gratis, sin tarjeta.</p>

      <button
        onClick={handleSubmit}
        disabled={pending || !name || !email}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Creando cuenta..." : "Empezar prueba gratis de 7 días"}
      </button>
    </div>
  );
}
