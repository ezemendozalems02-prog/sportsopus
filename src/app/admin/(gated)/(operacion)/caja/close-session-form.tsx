"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCashSessionAction } from "@/lib/actions";
import { formatCurrency } from "@/lib/format";

export function CloseSessionForm({ sessionId, expectedCash }: { sessionId: string; expectedCash: number }) {
  const router = useRouter();
  const [counted, setCounted] = useState(expectedCash);
  const [pending, startTransition] = useTransition();

  const difference = useMemo(() => counted - expectedCash, [counted, expectedCash]);

  function handleClose() {
    startTransition(async () => {
      await closeCashSessionAction(sessionId, counted);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Cerrar caja</p>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">Efectivo esperado</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-50">{formatCurrency(expectedCash)}</span>
      </div>

      <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-400">
        Efectivo contado
        <input
          type="number"
          min={0}
          value={counted}
          onChange={(e) => setCounted(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      {difference !== 0 && (
        <p className={`mt-2 text-sm font-medium ${difference > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {difference > 0 ? "Sobrante" : "Faltante"} de {formatCurrency(Math.abs(difference))}
        </p>
      )}

      <button
        onClick={handleClose}
        disabled={pending}
        className="mt-3 w-full rounded-xl bg-zinc-900 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Cerrando..." : "Cerrar caja"}
      </button>
    </div>
  );
}
