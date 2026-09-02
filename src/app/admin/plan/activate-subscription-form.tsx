"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateSubscriptionAction } from "@/lib/actions";
import type { Plan } from "@/lib/types";

export function ActivateSubscriptionForm({ plan, defaultEmail }: { plan: Plan; defaultEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
      <p className="font-medium text-emerald-800 dark:text-emerald-300">Activar suscripción ahora</p>
      <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
        Plan {plan.name} — USD {plan.priceUSD}/mes. Pago simulado con Mercado Pago Suscripciones (siempre aprobado, todavía sin credenciales reales conectadas).
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email de facturación"
        className="mt-3 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm dark:border-emerald-800 dark:bg-zinc-950"
      />
      <button
        onClick={() =>
          startTransition(async () => {
            await activateSubscriptionAction(email);
            router.refresh();
          })
        }
        disabled={pending || !email}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Procesando..." : `Pagar USD ${plan.priceUSD}/mes`}
      </button>
    </div>
  );
}
