"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSubscriptionAction, simulateTrialExpiredAction } from "@/lib/actions";

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (!confirm("¿Cancelar la suscripción? Vas a perder acceso al panel del negocio.")) return;
        startTransition(async () => {
          await cancelSubscriptionAction();
          router.refresh();
        });
      }}
      disabled={pending}
      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      {pending ? "Cancelando..." : "Cancelar suscripción"}
    </button>
  );
}

export function SimulateTrialExpiredButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await simulateTrialExpiredAction();
          router.refresh();
        })
      }
      disabled={pending}
      className="text-xs text-zinc-400 underline disabled:opacity-60"
    >
      {pending ? "..." : "Simular vencimiento de prueba (demo)"}
    </button>
  );
}
