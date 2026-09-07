"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signupAction } from "@/lib/actions";
import { formatCurrency } from "@/lib/format";
import type { Plan, PlanId } from "@/lib/types";

export function SignupForm({ plans, initialPlan }: { plans: Plan[]; initialPlan: PlanId }) {
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId)!;
  const canSubmit = orgName && ownerName && ownerEmail && ownerPassword.length >= 6;

  function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await signupAction({ orgName, ownerName, ownerEmail, ownerPassword, planId });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-400">
        Creamos una cuenta propia y aislada para tu complejo, con tu panel y tu link de reserva.
      </p>

      <label className="mt-4 block text-sm text-zinc-600 dark:text-zinc-400">
        Nombre de tu complejo
        <input
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Club Deportivo Belgrano"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Tu nombre
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Martín Suárez"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Email
        <input
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="martin@tucomplejo.com"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Contraseña
        <input
          type="password"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
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
              {p.name} — {formatCurrency(p.priceARS)}/mes
            </option>
          ))}
        </select>
      </label>

      <p className="mt-3 text-xs text-zinc-400">{plan.tagline}. Se paga con Mercado Pago después de crear la cuenta.</p>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={pending || !canSubmit}
        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="mt-4 text-center text-xs text-zinc-400">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-emerald-600 dark:text-emerald-400">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
