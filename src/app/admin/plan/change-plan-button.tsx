"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePlanAction } from "@/lib/actions";
import type { PlanId } from "@/lib/types";

export function ChangePlanButton({ planId, current }: { planId: PlanId; current: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(async () => {
        await changePlanAction(planId);
        router.refresh();
      })}
      disabled={pending || current}
      className={`w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 ${
        current
          ? "cursor-default bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
          : "bg-emerald-600 text-white hover:bg-emerald-700"
      }`}
    >
      {current ? "Plan actual" : pending ? "Cambiando..." : "Cambiar sin Mercado Pago"}
    </button>
  );
}
